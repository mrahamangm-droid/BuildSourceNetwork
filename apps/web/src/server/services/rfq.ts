import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, Prisma } from "@bmn/database";
import { assertBuyer, assertCan, assertOrgType, assertVerified, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { fieldErrorsFrom } from "./accounts";
import { audit, notifyOrg } from "./notify";
import { assertWithinLimit } from "./plans";

const code = (prefix: string) => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${d}-${randomBytes(3).toString("hex").toUpperCase()}`;
};
export const newRfqNumber = () => code("RFQ");
export const newOrderNumber = () => code("ORD");

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getSetting(key: string, fallback: string) {
  return (await db.platformSetting.findUnique({ where: { key } }))?.value ?? fallback;
}

// ───────────────────────── RFQ creation + supplier matching ─────────────────────────

export const rfqItemSchema = z.object({
  name: z.string().trim().min(2, "Enter the material").max(160),
  categoryId: z.string().optional().default(""),
  productId: z.string().optional().default(""),
  quantity: z.coerce.number().positive("Quantity must be greater than 0").max(1e9),
  unitCode: z.string().min(1, "Choose a unit"),
  specification: z.string().trim().max(500).optional().default(""),
});

export const rfqSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  mode: z.enum(["get3", "custom"]).default("get3"),
  deliveryCity: z.string().trim().min(2, "Enter the delivery location").max(80),
  deliveryAddress: z.string().trim().max(300).optional().default(""),
  requiredDate: z.string().optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
  items: z.array(rfqItemSchema).min(1, "Add at least one material").max(30),
  /** direct RFQ to specific suppliers (e.g. from a supplier profile page) */
  supplierOrgIds: z.array(z.string()).max(10).optional().default([]),
  /** project (BOQ) this request was raised from; must belong to the buyer's organization */
  projectId: z.string().optional().default(""),
});
export type RfqInput = z.infer<typeof rfqSchema>;

type Candidate = { orgId: string; score: number };

/**
 * Finds suppliers for an RFQ. A supplier must be active and sell something in at least one requested
 * category (or list that category on its profile). Score prefers in-stock matching products,
 * name matches, delivery coverage of the requested city, and verified status.
 */
export async function matchSuppliers(input: {
  buyerOrgId: string;
  deliveryCity: string;
  items: { categoryId?: string | null; name: string }[];
  limit: number;
}): Promise<Candidate[]> {
  const catIds = [...new Set(input.items.map((i) => i.categoryId).filter((x): x is string => !!x))];
  const scores = new Map<string, number>();
  const bump = (id: string, n: number) => scores.set(id, (scores.get(id) ?? 0) + n);

  const orgs = await db.organization.findMany({
    where: {
      type: "SUPPLIER",
      isActive: true,
      id: { not: input.buyerOrgId },
      OR: [
        {
          products: {
            some: { isActive: true, ...(catIds.length ? { categoryId: { in: catIds } } : {}) },
          },
        },
        ...(catIds.length ? [{ categories: { some: { id: { in: catIds } } } }] : []),
      ],
    },
    select: {
      id: true,
      city: true,
      deliveryAreas: true,
      verificationStatus: true,
      products: {
        where: { isActive: true },
        select: { name: true, categoryId: true, stockStatus: true, deliveryAvailable: true },
      },
    },
  });

  const city = input.deliveryCity.trim().toLowerCase();
  for (const o of orgs) {
    for (const it of input.items) {
      const words = it.name
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);
      const sameCat = o.products.filter((p) => it.categoryId && p.categoryId === it.categoryId);
      if (sameCat.length) bump(o.id, 3);
      if (sameCat.some((p) => p.stockStatus === "IN_STOCK" || p.stockStatus === "LOW_STOCK"))
        bump(o.id, 1);
      if (
        o.products.some((p) => words.length && words.every((w) => p.name.toLowerCase().includes(w)))
      )
        bump(o.id, 2);
    }
    const serves =
      (o.city ?? "").toLowerCase() === city ||
      o.deliveryAreas.some((a) => a.toLowerCase() === city);
    if (serves) bump(o.id, 2);
    if (o.verificationStatus === "VERIFIED") bump(o.id, 1);
    if (!scores.has(o.id)) scores.set(o.id, 0.5);
  }
  return [...scores.entries()]
    .map(([orgId, score]) => ({ orgId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit);
}

export async function createRfq(ctx: Ctx, raw: unknown) {
  assertBuyer(ctx);
  assertCan(ctx, "rfq.create");
  assertVerified(ctx);
  const parsed = rfqSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "Please fix the highlighted fields.",
      "VALIDATION",
      fieldErrorsFrom(parsed.error),
    );
  const d = parsed.data;

  await assertWithinLimit(ctx.orgId, "rfq");

  const unitCodes = [...new Set(d.items.map((i) => i.unitCode))];
  const units = await db.unit.findMany({
    where: { code: { in: unitCodes } },
    select: { code: true },
  });
  if (units.length !== unitCodes.length)
    throw new AppError("Unknown unit", "VALIDATION", { items: "One of the units is invalid" });

  // Resolve category for items chosen from the catalogue.
  const productIds = d.items.map((i) => i.productId).filter(Boolean);
  const products = productIds.length
    ? await db.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, categoryId: true },
      })
    : [];
  const items = d.items.map((i) => ({
    ...i,
    categoryId: i.categoryId || products.find((p) => p.id === i.productId)?.categoryId || "",
  }));

  let projectId: string | null = null;
  if (d.projectId) {
    // Only link to the buyer's own project. Anything else is silently ignored, never an error leak.
    const proj = await db.project.findFirst({
      where: { id: d.projectId, orgId: ctx.orgId },
      select: { id: true },
    });
    projectId = proj?.id ?? null;
  }

  let supplierIds: string[];
  if (d.supplierOrgIds.length) {
    const valid = await db.organization.findMany({
      where: {
        id: { in: d.supplierOrgIds },
        type: "SUPPLIER",
        isActive: true,
        NOT: { id: ctx.orgId },
      },
      select: { id: true },
    });
    supplierIds = valid.map((v) => v.id);
  } else {
    const limit = d.mode === "get3" ? 5 : 10;
    supplierIds = (
      await matchSuppliers({ buyerOrgId: ctx.orgId, deliveryCity: d.deliveryCity, items, limit })
    ).map((c) => c.orgId);
  }
  if (!supplierIds.length)
    throw new AppError(
      "No suppliers currently match this request. Try a broader category or another location.",
      "VALIDATION",
    );

  const expiryDays = Number(await getSetting("rfqExpiryDays", "7"));
  const requiredDate = d.requiredDate ? new Date(d.requiredDate) : null;
  if (requiredDate && Number.isNaN(requiredDate.getTime()))
    throw new AppError("Invalid date", "VALIDATION", { requiredDate: "Enter a valid date" });

  const rfq = await db.rfq.create({
    data: {
      number: newRfqNumber(),
      buyerOrgId: ctx.orgId,
      createdById: ctx.userId,
      title: d.title || null,
      deliveryCity: d.deliveryCity,
      deliveryAddress: d.deliveryAddress || null,
      requiredDate,
      notes: d.notes || null,
      isGetQuotes: d.mode === "get3",
      projectId,
      expiresAt: new Date(Date.now() + expiryDays * 864e5),
      items: {
        create: items.map((i) => ({
          name: i.name,
          categoryId: i.categoryId || null,
          productId: i.productId || null,
          quantity: i.quantity,
          unitCode: i.unitCode,
          specification: i.specification || null,
        })),
      },
      recipients: { create: supplierIds.map((supplierOrgId) => ({ supplierOrgId })) },
    },
    include: { items: true },
  });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "rfq.created",
    entity: "Rfq",
    entityId: rfq.id,
    meta: { suppliers: supplierIds.length },
  });
  await Promise.all(
    supplierIds.map((orgId) =>
      notifyOrg({
        orgId,
        type: "rfq.new",
        title: `New quote request ${rfq.number}`,
        body: `${rfq.items.length} item(s) • deliver to ${rfq.deliveryCity}`,
        href: `/dashboard/rfqs/${rfq.id}`,
      }),
    ),
  );
  return { rfq, supplierCount: supplierIds.length };
}

// ───────────────────────── expiry ─────────────────────────

/** Marks lapsed RFQs / recipients / quotes as expired. Called from the cron endpoint and before reads. */
export async function expireStale(now = new Date()) {
  const lapsed = await db.rfq.findMany({
    where: { status: "OPEN", expiresAt: { lt: now } },
    select: { id: true },
  });
  const ids = lapsed.map((r) => r.id);
  if (ids.length) {
    await db.$transaction([
      db.rfq.updateMany({ where: { id: { in: ids } }, data: { status: "EXPIRED" } }),
      db.rfqRecipient.updateMany({
        where: { rfqId: { in: ids }, status: { in: ["SENT", "VIEWED"] } },
        data: { status: "EXPIRED" },
      }),
      db.quote.updateMany({
        where: { rfqId: { in: ids }, status: "SUBMITTED" },
        data: { status: "EXPIRED" },
      }),
    ]);
  }
  await db.quote.updateMany({
    where: { status: "SUBMITTED", validUntil: { lt: now } },
    data: { status: "EXPIRED" },
  });
  return ids.length;
}

// ───────────────────────── buyer side ─────────────────────────

export async function listBuyerRfqs(ctx: Ctx) {
  assertBuyer(ctx);
  return db.rfq.findMany({
    where: { buyerOrgId: ctx.orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      items: true,
      recipients: { select: { status: true } },
      _count: { select: { quotes: true } },
    },
  });
}

export async function getBuyerRfq(ctx: Ctx, id: string) {
  assertBuyer(ctx);
  const rfq = await db.rfq.findFirst({
    where: { id, buyerOrgId: ctx.orgId },
    include: {
      items: { include: { unit: true, category: true }, orderBy: { name: "asc" } },
      recipients: {
        include: {
          supplierOrg: {
            select: {
              id: true,
              name: true,
              slug: true,
              verificationStatus: true,
              city: true,
              isDemo: true,
            },
          },
        },
      },
      quotes: {
        include: {
          items: true,
          supplierOrg: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
              supplierKind: true,
              verificationStatus: true,
              city: true,
              isDemo: true,
            },
          },
          order: { select: { id: true, number: true } },
        },
        orderBy: { totalAmount: "asc" },
      },
      orders: { select: { id: true, number: true } },
    },
  });
  return rfq;
}

export async function cancelRfq(ctx: Ctx, id: string) {
  assertBuyer(ctx);
  assertCan(ctx, "rfq.create");
  const res = await db.rfq.updateMany({
    where: { id, buyerOrgId: ctx.orgId, status: "OPEN" },
    data: { status: "CANCELLED" },
  });
  if (res.count === 0) throw new AppError("This RFQ can no longer be cancelled.", "CONFLICT");
  await db.rfqRecipient.updateMany({
    where: { rfqId: id, status: { in: ["SENT", "VIEWED"] } },
    data: { status: "EXPIRED" },
  });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "rfq.cancelled",
    entity: "Rfq",
    entityId: id,
  });
}

// ───────────────────────── supplier side ─────────────────────────

export async function listSupplierInbox(ctx: Ctx) {
  assertOrgType(ctx, "SUPPLIER");
  return db.rfqRecipient.findMany({
    where: { supplierOrgId: ctx.orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      rfq: {
        include: {
          items: { select: { name: true } },
          buyerOrg: { select: { name: true, city: true } },
        },
      },
    },
  });
}

/** Supplier's view of an RFQ. Only recipients may open it; opening marks it Viewed. */
export async function getSupplierRfq(ctx: Ctx, rfqId: string) {
  assertOrgType(ctx, "SUPPLIER");
  const recipient = await db.rfqRecipient.findUnique({
    where: { rfqId_supplierOrgId: { rfqId, supplierOrgId: ctx.orgId } },
  });
  if (!recipient) return null;
  if (recipient.status === "SENT") {
    await db.rfqRecipient.update({
      where: { id: recipient.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
    recipient.status = "VIEWED";
  }
  const rfq = await db.rfq.findUniqueOrThrow({
    where: { id: rfqId },
    select: {
      id: true,
      number: true,
      title: true,
      deliveryCity: true,
      deliveryAddress: true,
      requiredDate: true,
      notes: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      buyerOrg: { select: { name: true, city: true } },
      items: { include: { unit: true }, orderBy: { name: "asc" } },
    },
  });
  const quote = await db.quote.findUnique({
    where: { rfqId_supplierOrgId: { rfqId, supplierOrgId: ctx.orgId } },
    include: { items: true, order: { select: { id: true } } },
  });
  return { rfq, recipient, quote };
}

export const quoteSchema = z.object({
  deliveryDays: z.coerce.number().int().min(0).max(365).optional(),
  deliveryCost: z.coerce.number().min(0).max(1e9).default(0),
  validDays: z.coerce.number().int().min(1).max(90).default(7),
  notes: z.string().trim().max(1000).optional().default(""),
  items: z
    .array(
      z.object({
        rfqItemId: z.string(),
        unitPrice: z.coerce.number().positive("Enter a price").max(1e9),
        quantityAvailable: z.coerce.number().min(0, "Cannot be negative").max(1e9),
        minOrderQty: z.coerce.number().positive().max(1e9).default(1),
        notes: z.string().trim().max(300).optional().default(""),
      }),
    )
    .min(1),
});

export async function submitQuote(ctx: Ctx, rfqId: string, raw: unknown) {
  assertOrgType(ctx, "SUPPLIER");
  assertCan(ctx, "rfq.respond");
  assertVerified(ctx);
  const parsed = quoteSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "Please fix the highlighted fields.",
      "VALIDATION",
      fieldErrorsFrom(parsed.error),
    );
  const d = parsed.data;

  const recipient = await db.rfqRecipient.findUnique({
    where: { rfqId_supplierOrgId: { rfqId, supplierOrgId: ctx.orgId } },
  });
  if (!recipient) throw new AppError("RFQ not found", "NOT_FOUND");
  const rfq = await db.rfq.findUniqueOrThrow({ where: { id: rfqId }, include: { items: true } });
  if (rfq.status !== "OPEN" || rfq.expiresAt < new Date())
    throw new AppError("This RFQ is no longer accepting quotes.", "CONFLICT");

  const existing = await db.quote.findUnique({
    where: { rfqId_supplierOrgId: { rfqId, supplierOrgId: ctx.orgId } },
  });
  if (existing && existing.status !== "SUBMITTED")
    throw new AppError("This quote can no longer be changed.", "CONFLICT");

  const byId = new Map(d.items.map((i) => [i.rfqItemId, i]));
  let total = 0;
  for (const it of rfq.items) {
    const line = byId.get(it.id);
    if (!line)
      throw new AppError("Price every requested item.", "VALIDATION", {
        items: `Missing price for ${it.name}`,
      });
    total += line.unitPrice * Math.min(line.quantityAvailable, Number(it.quantity));
  }
  for (const id of byId.keys())
    if (!rfq.items.some((i) => i.id === id))
      throw new AppError("Unknown item in quote.", "VALIDATION");
  total = round2(total + d.deliveryCost);

  const validUntil = new Date(Date.now() + d.validDays * 864e5);
  const quote = await db.$transaction(async (tx) => {
    if (existing) await tx.quoteItem.deleteMany({ where: { quoteId: existing.id } });
    const data = {
      deliveryDays: d.deliveryDays ?? null,
      deliveryCost: d.deliveryCost,
      validUntil,
      notes: d.notes || null,
      totalAmount: total,
      items: {
        create: d.items.map((i) => ({
          rfqItemId: i.rfqItemId,
          unitPrice: i.unitPrice,
          quantityAvailable: i.quantityAvailable,
          minOrderQty: i.minOrderQty,
          notes: i.notes || null,
        })),
      },
    };
    const q = existing
      ? await tx.quote.update({ where: { id: existing.id }, data })
      : await tx.quote.create({ data: { rfqId, supplierOrgId: ctx.orgId, ...data } });
    await tx.rfqRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "RESPONDED",
        respondedAt: new Date(),
        viewedAt: recipient.viewedAt ?? new Date(),
      },
    });
    return q;
  });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: existing ? "quote.updated" : "quote.submitted",
    entity: "Quote",
    entityId: quote.id,
  });
  if (!existing) {
    const org = await db.organization.findUniqueOrThrow({
      where: { id: ctx.orgId },
      select: { name: true },
    });
    await notifyOrg({
      orgId: rfq.buyerOrgId,
      type: "quote.received",
      title: `Quote received for ${rfq.number}`,
      body: `${org.name} quoted ${quote.totalAmount.toString()} ${quote.currency}`,
      href: `/dashboard/rfqs/${rfq.id}`,
    });
  }
  return quote;
}

export async function declineRfq(ctx: Ctx, rfqId: string) {
  assertOrgType(ctx, "SUPPLIER");
  const res = await db.rfqRecipient.updateMany({
    where: { rfqId, supplierOrgId: ctx.orgId, status: { in: ["SENT", "VIEWED"] } },
    data: { status: "DECLINED" },
  });
  if (res.count === 0) throw new AppError("Cannot decline this RFQ.", "CONFLICT");
}

// ───────────────────────── accept quote → order ─────────────────────────

export async function acceptQuote(ctx: Ctx, quoteId: string) {
  assertBuyer(ctx);
  assertCan(ctx, "order.manage");
  assertVerified(ctx);
  const fee = Number(await getSetting("platformFeeBps", "100"));

  const order = await db.$transaction(
    async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        include: { items: { include: { rfqItem: true } }, rfq: true },
      });
      // Ownership check: the RFQ must belong to the caller's org.
      if (!quote || quote.rfq.buyerOrgId !== ctx.orgId)
        throw new AppError("Quote not found", "NOT_FOUND");
      if (quote.status !== "SUBMITTED")
        throw new AppError("This quote is no longer available.", "CONFLICT");
      if (quote.validUntil < new Date()) throw new AppError("This quote has expired.", "CONFLICT");

      // Guard against double-accept races: only one transaction can flip OPEN → ACCEPTED.
      const flipped = await tx.rfq.updateMany({
        where: { id: quote.rfqId, status: "OPEN" },
        data: { status: "ACCEPTED" },
      });
      if (flipped.count !== 1) throw new AppError("This RFQ has already been closed.", "CONFLICT");

      await tx.quote.update({ where: { id: quote.id }, data: { status: "ACCEPTED" } });
      await tx.quote.updateMany({
        where: { rfqId: quote.rfqId, id: { not: quote.id }, status: "SUBMITTED" },
        data: { status: "REJECTED" },
      });
      await tx.rfqRecipient.updateMany({
        where: { rfqId: quote.rfqId, status: { in: ["SENT", "VIEWED"] } },
        data: { status: "EXPIRED" },
      });

      const lines = quote.items
        .map((qi) => {
          const qty = Math.min(Number(qi.quantityAvailable), Number(qi.rfqItem.quantity));
          return {
            name: qi.rfqItem.name,
            quantity: qty,
            unitCode: qi.rfqItem.unitCode,
            unitPrice: Number(qi.unitPrice),
            lineTotal: round2(qty * Number(qi.unitPrice)),
          };
        })
        .filter((l) => l.quantity > 0);
      if (!lines.length) throw new AppError("This quote has no available quantity.", "CONFLICT");
      const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
      const deliveryCost = Number(quote.deliveryCost);

      return tx.order.create({
        data: {
          number: newOrderNumber(),
          buyerOrgId: ctx.orgId,
          supplierOrgId: quote.supplierOrgId,
          rfqId: quote.rfqId,
          quoteId: quote.id,
          createdById: ctx.userId,
          currency: quote.currency,
          subtotal,
          deliveryCost,
          totalAmount: round2(subtotal + deliveryCost),
          platformFeeBps: fee,
          deliveryCity: quote.rfq.deliveryCity,
          deliveryAddress: quote.rfq.deliveryAddress,
          requiredDate: quote.rfq.requiredDate,
          items: { create: lines },
          events: {
            create: { status: "ORDER_CREATED", actorId: ctx.userId, note: "Quote accepted" },
          },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "quote.accepted",
    entity: "Order",
    entityId: order.id,
  });
  await notifyOrg({
    orgId: order.supplierOrgId,
    type: "quote.accepted",
    title: `Quote accepted — order ${order.number}`,
    body: "Please confirm the order.",
    href: `/dashboard/orders/${order.id}`,
  });
  return order;
}
