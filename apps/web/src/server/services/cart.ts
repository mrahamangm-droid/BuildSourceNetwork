import { z } from "zod";
import { db, Prisma } from "@bmn/database";
import { assertBuyer, assertCan, assertVerified, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { audit, notifyOrg } from "./notify";
import { getSetting, newOrderNumber } from "./rfq";
import { fromCents, toCents, unitPriceFor, type Break } from "@/lib/pricing";

/**
 * Multi-supplier cart, saved lists and reorder. The cart belongs to the buyer company (shared by
 * its team). Checkout splits it into one order per supplier, priced at the listed price plus any
 * volume break the quantity qualifies for; delivery is agreed with each supplier afterwards.
 */

export const CART_MAX_LINES = 200;
export const LIST_MAX_LISTS = 50;
export const LIST_MAX_ITEMS = 300;
const MAX_QTY = 1_000_000;

const round2 = (n: number) => Math.round(n * 100) / 100;

const qtySchema = z.coerce
  .number({ message: "Enter a quantity" })
  .positive("Quantity must be more than zero")
  .max(MAX_QTY, "That quantity is too large")
  .transform((n) => Math.round(n * 1000) / 1000);

function guard(ctx: Ctx) {
  assertBuyer(ctx);
  assertCan(ctx, "rfq.create");
}

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) throw new AppError(r.error.issues[0]?.message ?? "Invalid input", "VALIDATION");
  return r.data;
}

const productSelect = {
  id: true,
  name: true,
  sku: true,
  orgId: true,
  price: true,
  currency: true,
  unitCode: true,
  minOrderQty: true,
  stockStatus: true,
  isActive: true,
  vatRatePercent: true,
  org: { select: { id: true, name: true, isActive: true } },
  unit: { select: { name: true } },
  images: { select: { url: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
  priceBreaks: { select: { minQty: true, price: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

const breaksOf = (p: ProductRow): Break[] =>
  p.priceBreaks.map((b) => ({ minQty: Number(b.minQty), price: Number(b.price) }));

/** Why a line cannot be ordered right now, or null when it can. */
function lineIssue(p: ProductRow, qty: number): string | null {
  if (!p.isActive || !p.org.isActive) return "No longer available";
  if (p.stockStatus === "OUT_OF_STOCK") return "Out of stock";
  if (qty < Number(p.minOrderQty) - 1e-9) return `Minimum order is ${Number(p.minOrderQty)}`;
  return null;
}

export type CartLine = {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  image: string | null;
  unit: string;
  quantity: number;
  minOrderQty: number;
  unitPrice: number;
  basePrice: number;
  lineTotal: number;
  vatPercent: number;
  currency: string;
  issue: string | null;
};
export type CartGroup = {
  supplierOrgId: string;
  supplierName: string;
  currency: string;
  lines: CartLine[];
  subtotal: number;
  vat: number;
  orderable: boolean;
};

function buildLine(id: string, quantity: number, p: ProductRow): CartLine {
  const unitPrice = unitPriceFor(Number(p.price), breaksOf(p), quantity);
  return {
    id,
    productId: p.id,
    name: p.name,
    sku: p.sku,
    image: p.images[0]?.url ?? null,
    unit: p.unit.name.toLowerCase(),
    quantity,
    minOrderQty: Number(p.minOrderQty),
    unitPrice,
    basePrice: Number(p.price),
    lineTotal: fromCents(Math.round((toCents(unitPrice) * Math.round(quantity * 1000)) / 1000)),
    vatPercent: Number(p.vatRatePercent),
    currency: p.currency,
    issue: lineIssue(p, quantity),
  };
}

function groupLines(
  rows: { id: string; quantity: Prisma.Decimal; product: ProductRow }[],
): CartGroup[] {
  const groups = new Map<string, CartGroup>();
  for (const r of rows) {
    const key = `${r.product.orgId}|${r.product.currency}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        supplierOrgId: r.product.orgId,
        supplierName: r.product.org.name,
        currency: r.product.currency,
        lines: [],
        subtotal: 0,
        vat: 0,
        orderable: true,
      };
      groups.set(key, g);
    }
    const line = buildLine(r.id, Number(r.quantity), r.product);
    g.lines.push(line);
    if (line.issue) g.orderable = false;
    else {
      g.subtotal = round2(g.subtotal + line.lineTotal);
      g.vat = round2(g.vat + (line.lineTotal * line.vatPercent) / 100);
    }
  }
  return [...groups.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

export async function getCart(ctx: Ctx) {
  guard(ctx);
  const rows = await db.cartItem.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: "asc" },
    select: { id: true, quantity: true, product: { select: productSelect } },
  });
  const groups = groupLines(rows);
  return {
    groups,
    lineCount: rows.length,
    subtotal: round2(groups.reduce((s, g) => s + g.subtotal, 0)),
    vat: round2(groups.reduce((s, g) => s + g.vat, 0)),
  };
}

/** Number of lines, for the header badge. Cheap and safe for any signed-in user. */
export async function cartCount(ctx: Ctx | null) {
  if (!ctx) return 0;
  return db.cartItem.count({ where: { orgId: ctx.orgId } });
}

async function assertBuyable(ctx: Ctx, productId: string) {
  const p = await db.product.findFirst({
    where: { id: productId, isActive: true, org: { isActive: true } },
    select: { id: true, orgId: true, minOrderQty: true },
  });
  if (!p) throw new AppError("This product is not available.", "NOT_FOUND");
  if (p.orgId === ctx.orgId)
    throw new AppError("You cannot order your own products.", "VALIDATION");
  return p;
}

export async function addToCart(ctx: Ctx, raw: unknown) {
  guard(ctx);
  const { productId, quantity } = parse(
    z.object({ productId: z.string().min(1), quantity: qtySchema.optional() }),
    raw,
  );
  const p = await assertBuyable(ctx, productId);
  const add = quantity ?? Number(p.minOrderQty);
  const existing = await db.cartItem.findUnique({
    where: { orgId_productId: { orgId: ctx.orgId, productId } },
  });
  if (!existing && (await db.cartItem.count({ where: { orgId: ctx.orgId } })) >= CART_MAX_LINES)
    throw new AppError(
      `Your cart is full (${CART_MAX_LINES} lines). Check out or remove some.`,
      "CONFLICT",
    );
  const total = Math.min(MAX_QTY, (existing ? Number(existing.quantity) : 0) + add);
  await db.cartItem.upsert({
    where: { orgId_productId: { orgId: ctx.orgId, productId } },
    create: { orgId: ctx.orgId, productId, quantity: total },
    update: { quantity: total },
  });
  return { count: await db.cartItem.count({ where: { orgId: ctx.orgId } }) };
}

export async function setCartQuantity(ctx: Ctx, raw: unknown) {
  guard(ctx);
  const { itemId, quantity } = parse(
    z.object({ itemId: z.string().min(1), quantity: qtySchema }),
    raw,
  );
  const r = await db.cartItem.updateMany({
    where: { id: itemId, orgId: ctx.orgId },
    data: { quantity },
  });
  if (!r.count) throw new AppError("Cart line not found", "NOT_FOUND");
}

export async function removeCartItem(ctx: Ctx, itemId: string) {
  guard(ctx);
  await db.cartItem.deleteMany({ where: { id: itemId, orgId: ctx.orgId } });
}

export async function clearCart(ctx: Ctx) {
  guard(ctx);
  await db.cartItem.deleteMany({ where: { orgId: ctx.orgId } });
}

const checkoutSchema = z.object({
  deliveryCity: z.string().trim().min(2, "Enter the delivery city").max(80),
  deliveryAddress: z.string().trim().max(300).optional(),
  requiredDate: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  /** Check out only these suppliers; the rest stay in the cart. Omit for everything orderable. */
  supplierOrgIds: z.array(z.string()).max(100).optional(),
});

/**
 * Turn the cart into orders, one per supplier and currency. Lines that can no longer be ordered
 * (inactive, out of stock, below minimum) stay in the cart and are reported back; nothing is
 * silently dropped. All orders are created in one transaction, so a failure creates none.
 */
export async function checkoutCart(ctx: Ctx, raw: unknown) {
  guard(ctx);
  assertCan(ctx, "order.manage");
  assertVerified(ctx);
  const input = parse(checkoutSchema, raw);
  let requiredDate: Date | null = null;
  if (input.requiredDate) {
    requiredDate = new Date(input.requiredDate);
    if (Number.isNaN(requiredDate.getTime()))
      throw new AppError("Enter a valid required date", "VALIDATION");
  }
  const fee = Number(await getSetting("platformFeeBps", "100"));

  const result = await db.$transaction(
    async (tx) => {
      const rows = await tx.cartItem.findMany({
        where: { orgId: ctx.orgId },
        select: { id: true, quantity: true, product: { select: productSelect } },
      });
      if (!rows.length) throw new AppError("Your cart is empty.", "VALIDATION");
      const only = input.supplierOrgIds ? new Set(input.supplierOrgIds) : null;
      const skipped: { name: string; reason: string }[] = [];
      const buckets = new Map<string, { row: (typeof rows)[number]; line: CartLine }[]>();
      for (const r of rows) {
        if (only && !only.has(r.product.orgId)) continue;
        const line = buildLine(r.id, Number(r.quantity), r.product);
        if (line.issue) {
          skipped.push({ name: line.name, reason: line.issue });
          continue;
        }
        const key = `${r.product.orgId}|${r.product.currency}`;
        (buckets.get(key) ?? buckets.set(key, []).get(key)!).push({ row: r, line });
      }
      if (!buckets.size)
        throw new AppError("Nothing in your cart can be ordered right now.", "VALIDATION");

      const orders: { id: string; number: string; supplierOrgId: string; total: number }[] = [];
      for (const entries of buckets.values()) {
        const first = entries[0]!.row.product;
        const subtotal = round2(entries.reduce((s, e) => s + e.line.lineTotal, 0));
        const order = await tx.order.create({
          data: {
            number: newOrderNumber(),
            buyerOrgId: ctx.orgId,
            supplierOrgId: first.orgId,
            createdById: ctx.userId,
            currency: first.currency,
            subtotal,
            deliveryCost: 0,
            totalAmount: subtotal,
            platformFeeBps: fee,
            deliveryCity: input.deliveryCity,
            deliveryAddress: input.deliveryAddress || null,
            requiredDate,
            notes: input.notes || null,
            items: {
              create: entries.map((e) => ({
                name: e.line.name,
                quantity: e.line.quantity,
                unitCode: e.row.product.unitCode,
                unitPrice: e.line.unitPrice,
                lineTotal: e.line.lineTotal,
                productId: e.line.productId,
              })),
            },
            events: {
              create: { status: "ORDER_CREATED", actorId: ctx.userId, note: "Ordered from cart" },
            },
          },
        });
        orders.push({
          id: order.id,
          number: order.number,
          supplierOrgId: order.supplierOrgId,
          total: subtotal,
        });
        await tx.cartItem.deleteMany({
          where: { id: { in: entries.map((e) => e.row.id) }, orgId: ctx.orgId },
        });
      }
      return { orders, skipped };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  for (const o of result.orders) {
    await audit({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: "cart.checkout",
      entity: "Order",
      entityId: o.id,
    });
    await notifyOrg({
      orgId: o.supplierOrgId,
      type: "order.created",
      title: `New order ${o.number}`,
      body: "A buyer ordered directly from your catalogue. Please confirm the order.",
      href: `/dashboard/orders/${o.id}`,
    });
  }
  return result;
}

/** Put the products from a past order back in the cart at the quantities ordered. */
export async function reorderToCart(ctx: Ctx, orderId: string) {
  guard(ctx);
  const order = await db.order.findFirst({
    where: { id: orderId, buyerOrgId: ctx.orgId },
    select: { items: { select: { name: true, quantity: true, productId: true } } },
  });
  if (!order) throw new AppError("Order not found", "NOT_FOUND");
  return addLinesToCart(
    ctx,
    order.items.map((i) => ({
      name: i.name,
      productId: i.productId,
      quantity: Number(i.quantity),
    })),
  );
}

async function addLinesToCart(
  ctx: Ctx,
  lines: { name: string; productId: string | null; quantity: number }[],
) {
  const ids = lines.map((l) => l.productId).filter((x): x is string => !!x);
  const live = new Map(
    (
      await db.product.findMany({
        where: {
          id: { in: ids },
          isActive: true,
          org: { isActive: true },
          orgId: { not: ctx.orgId },
        },
        select: { id: true, minOrderQty: true },
      })
    ).map((p) => [p.id, p]),
  );
  const have = await db.cartItem.count({ where: { orgId: ctx.orgId } });
  const inCart = new Set(
    (
      await db.cartItem.findMany({
        where: { orgId: ctx.orgId, productId: { in: ids } },
        select: { productId: true },
      })
    ).map((c) => c.productId),
  );
  const added: string[] = [];
  const skipped: { name: string; reason: string }[] = [];
  let room = CART_MAX_LINES - have;
  for (const l of lines) {
    const p = l.productId ? live.get(l.productId) : undefined;
    if (!p) {
      skipped.push({ name: l.name, reason: "No longer available" });
      continue;
    }
    if (!inCart.has(p.id)) {
      if (room <= 0) {
        skipped.push({ name: l.name, reason: "Cart is full" });
        continue;
      }
      room--;
    }
    const qty = Math.max(l.quantity, Number(p.minOrderQty));
    await db.cartItem.upsert({
      where: { orgId_productId: { orgId: ctx.orgId, productId: p.id } },
      create: { orgId: ctx.orgId, productId: p.id, quantity: qty },
      update: { quantity: qty },
    });
    inCart.add(p.id);
    added.push(l.name);
  }
  return { added: added.length, skipped };
}

// ───────────────────────────── saved lists ─────────────────────────────

const nameSchema = z.string().trim().min(1, "Give the list a name").max(80);

function uniqueName(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
    throw new AppError("You already have a list with that name.", "CONFLICT");
  throw e;
}

export async function listLists(ctx: Ctx) {
  guard(ctx);
  const lists = await db.savedList.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    count: l._count.items,
    updatedAt: l.updatedAt,
  }));
}

async function ownList(ctx: Ctx, id: string) {
  const l = await db.savedList.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!l) throw new AppError("List not found", "NOT_FOUND");
  return l;
}

export async function createList(ctx: Ctx, raw: unknown) {
  guard(ctx);
  const { name } = parse(z.object({ name: nameSchema }), raw);
  if ((await db.savedList.count({ where: { orgId: ctx.orgId } })) >= LIST_MAX_LISTS)
    throw new AppError(`You can keep up to ${LIST_MAX_LISTS} lists.`, "CONFLICT");
  try {
    return await db.savedList.create({
      data: { orgId: ctx.orgId, createdById: ctx.userId, name },
    });
  } catch (e) {
    return uniqueName(e);
  }
}

export async function renameList(ctx: Ctx, id: string, raw: unknown) {
  guard(ctx);
  const { name } = parse(z.object({ name: nameSchema }), raw);
  await ownList(ctx, id);
  try {
    await db.savedList.update({ where: { id }, data: { name } });
  } catch (e) {
    uniqueName(e);
  }
}

export async function deleteList(ctx: Ctx, id: string) {
  guard(ctx);
  await db.savedList.deleteMany({ where: { id, orgId: ctx.orgId } });
}

export async function getList(ctx: Ctx, id: string) {
  guard(ctx);
  const list = await db.savedList.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      items: { orderBy: { createdAt: "asc" }, include: { product: { select: productSelect } } },
    },
  });
  if (!list) return null;
  return {
    id: list.id,
    name: list.name,
    items: list.items.map((i) => ({
      ...buildLine(i.id, Number(i.quantity), i.product),
      note: i.note,
    })),
  };
}

export async function addToList(ctx: Ctx, listId: string, raw: unknown) {
  guard(ctx);
  const { productId, quantity } = parse(
    z.object({ productId: z.string().min(1), quantity: qtySchema.optional() }),
    raw,
  );
  await ownList(ctx, listId);
  const p = await db.product.findFirst({
    where: { id: productId, isActive: true },
    select: { minOrderQty: true },
  });
  if (!p) throw new AppError("This product is not available.", "NOT_FOUND");
  const exists = await db.savedListItem.findUnique({
    where: { listId_productId: { listId, productId } },
  });
  if (!exists && (await db.savedListItem.count({ where: { listId } })) >= LIST_MAX_ITEMS)
    throw new AppError(`A list can hold up to ${LIST_MAX_ITEMS} products.`, "CONFLICT");
  await db.savedListItem.upsert({
    where: { listId_productId: { listId, productId } },
    create: { listId, productId, quantity: quantity ?? Number(p.minOrderQty) },
    update: quantity ? { quantity } : {},
  });
  await db.savedList.update({ where: { id: listId }, data: { updatedAt: new Date() } });
}

export async function updateListItem(ctx: Ctx, listId: string, itemId: string, raw: unknown) {
  guard(ctx);
  const { quantity, note } = parse(
    z.object({ quantity: qtySchema.optional(), note: z.string().trim().max(200).optional() }),
    raw,
  );
  await ownList(ctx, listId);
  const r = await db.savedListItem.updateMany({
    where: { id: itemId, listId },
    data: {
      ...(quantity ? { quantity } : {}),
      ...(note !== undefined ? { note: note || null } : {}),
    },
  });
  if (!r.count) throw new AppError("Item not found", "NOT_FOUND");
}

export async function removeListItem(ctx: Ctx, listId: string, itemId: string) {
  guard(ctx);
  await ownList(ctx, listId);
  await db.savedListItem.deleteMany({ where: { id: itemId, listId } });
}

/** Move a whole list into the cart (the reorder button). */
export async function addListToCart(ctx: Ctx, listId: string) {
  guard(ctx);
  await ownList(ctx, listId);
  const items = await db.savedListItem.findMany({
    where: { listId },
    include: { product: { select: { name: true } } },
  });
  return addLinesToCart(
    ctx,
    items.map((i) => ({
      name: i.product.name,
      productId: i.productId,
      quantity: Number(i.quantity),
    })),
  );
}

export async function saveCartAsList(ctx: Ctx, raw: unknown) {
  guard(ctx);
  const { name } = parse(z.object({ name: nameSchema }), raw);
  const cart = await db.cartItem.findMany({ where: { orgId: ctx.orgId } });
  if (!cart.length) throw new AppError("Your cart is empty.", "VALIDATION");
  if ((await db.savedList.count({ where: { orgId: ctx.orgId } })) >= LIST_MAX_LISTS)
    throw new AppError(`You can keep up to ${LIST_MAX_LISTS} lists.`, "CONFLICT");
  try {
    return await db.savedList.create({
      data: {
        orgId: ctx.orgId,
        createdById: ctx.userId,
        name,
        items: {
          create: cart.slice(0, LIST_MAX_ITEMS).map((c) => ({
            productId: c.productId,
            quantity: c.quantity,
          })),
        },
      },
    });
  } catch (e) {
    return uniqueName(e);
  }
}

/** Which of the buyer's lists already hold this product (for the "Save to list" menu). */
export async function listsForProduct(ctx: Ctx, productId: string) {
  guard(ctx);
  const [lists, inLists] = await Promise.all([
    db.savedList.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.savedListItem.findMany({
      where: { productId, list: { orgId: ctx.orgId } },
      select: { listId: true },
    }),
  ]);
  const has = new Set(inLists.map((i) => i.listId));
  return lists.map((l) => ({ ...l, has: has.has(l.id) }));
}
