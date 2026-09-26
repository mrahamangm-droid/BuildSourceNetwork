import { z } from "zod";
import { db } from "@bmn/database";
import { ORDER_TRANSITIONS, ORDER_STATUS_LABEL, type OrderStatus } from "@bmn/config";
import { assertCan, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { audit, notifyOrg } from "./notify";
import { syncOrderStock } from "./order-stock";
import { regularMaterials } from "@/lib/reorder";

/** Orders are visible only to the buying org and the supplying org. */
const scope = (ctx: Ctx) => ({ OR: [{ buyerOrgId: ctx.orgId }, { supplierOrgId: ctx.orgId }] });

export async function listOrders(ctx: Ctx) {
  return db.order.findMany({
    where: scope(ctx),
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      buyerOrg: { select: { name: true } },
      supplierOrg: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
}

export async function getOrder(ctx: Ctx, id: string) {
  return db.order.findFirst({
    where: { id, ...scope(ctx) },
    include: {
      items: { include: { unit: true } },
      events: { orderBy: { createdAt: "asc" } },
      buyerOrg: { select: { id: true, name: true, city: true, phone: true, email: true } },
      supplierOrg: {
        select: { id: true, name: true, slug: true, city: true, phone: true, email: true },
      },
      reviews: true,
      deliveries: true,
    },
  });
}

/** Which transitions the caller may perform on this order. */
export function allowedTransitions(
  ctx: Ctx,
  order: { status: OrderStatus; buyerOrgId: string; supplierOrgId: string },
): OrderStatus[] {
  const next = ORDER_TRANSITIONS[order.status];
  const isSupplier = order.supplierOrgId === ctx.orgId;
  const isBuyer = order.buyerOrgId === ctx.orgId;
  return next.filter((s) => {
    if (s === "CANCELLED")
      return (
        (isSupplier || isBuyer) &&
        ["ORDER_CREATED", "CONFIRMED", "PREPARING"].includes(order.status)
      );
    if (s === "COMPLETED") return isBuyer;
    return isSupplier; // CONFIRMED, PREPARING, DISPATCHED, DELIVERED are supplier-driven
  });
}

export async function advanceOrder(ctx: Ctx, orderId: string, next: OrderStatus, note?: string) {
  assertCan(ctx, "order.manage");
  const order = await db.order.findFirst({ where: { id: orderId, ...scope(ctx) } });
  if (!order) throw new AppError("Order not found", "NOT_FOUND");
  if (!allowedTransitions(ctx, order).includes(next))
    throw new AppError(
      `You cannot move this order to "${ORDER_STATUS_LABEL[next]}" right now.`,
      "FORBIDDEN",
    );

  // Optimistic guard: only flips if the status has not changed underneath us.
  const res = await db.order.updateMany({
    where: { id: orderId, status: order.status },
    data: { status: next },
  });
  if (res.count !== 1)
    throw new AppError("The order was updated by someone else. Refresh and try again.", "CONFLICT");
  await db.orderEvent.create({
    data: { orderId, status: next, actorId: ctx.userId, note: note?.slice(0, 500) || null },
  });

  if (next === "DELIVERED") {
    await db.delivery.updateMany({
      where: { orderId, status: { not: "DELIVERED" } },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
  }
  await syncOrderStock(orderId, next);
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: `order.${next.toLowerCase()}`,
    entity: "Order",
    entityId: orderId,
  });
  const otherOrg = order.buyerOrgId === ctx.orgId ? order.supplierOrgId : order.buyerOrgId;
  await notifyOrg({
    orgId: otherOrg,
    type: "order.status",
    title: `Order ${order.number}: ${ORDER_STATUS_LABEL[next]}`,
    href: `/dashboard/orders/${orderId}`,
  });
}

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  comment: z.string().trim().max(1000).optional().default(""),
});

/** One review per COMPLETED order, written only by the buying org. */
export async function submitReview(ctx: Ctx, orderId: string, raw: unknown) {
  assertCan(ctx, "order.view");
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(parsed.error.issues[0].message, "VALIDATION", {
      rating: parsed.error.issues[0].message,
    });
  const order = await db.order.findFirst({ where: { id: orderId, buyerOrgId: ctx.orgId } });
  if (!order) throw new AppError("Order not found", "NOT_FOUND");
  if (order.status !== "COMPLETED")
    throw new AppError("You can review an order once it is completed.", "FORBIDDEN");
  if (await db.review.findUnique({ where: { orderId } }))
    throw new AppError("You already reviewed this order.", "CONFLICT");
  const review = await db.review.create({
    data: {
      orderId,
      authorOrgId: ctx.orgId,
      subjectOrgId: order.supplierOrgId,
      authorId: ctx.userId,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
    },
  });
  await notifyOrg({
    orgId: order.supplierOrgId,
    type: "review.received",
    title: `New ${parsed.data.rating}★ review`,
    href: `/dashboard/orders/${orderId}`,
  });
  return review;
}

export async function dashboardStats(ctx: Ctx) {
  const isSupplier = ctx.orgType === "SUPPLIER";
  const orderWhere = isSupplier ? { supplierOrgId: ctx.orgId } : { buyerOrgId: ctx.orgId };
  const [orders, openOrders, revenue, unread] = await Promise.all([
    db.order.count({ where: orderWhere }),
    db.order.count({
      where: {
        ...orderWhere,
        status: { in: ["ORDER_CREATED", "CONFIRMED", "PREPARING", "DISPATCHED"] },
      },
    }),
    db.order.aggregate({
      where: { ...orderWhere, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
    }),
    db.notification.count({ where: { userId: ctx.userId, readAt: null } }),
  ]);
  if (isSupplier) {
    const [inbox, toQuote, quotes, products] = await Promise.all([
      db.rfqRecipient.count({ where: { supplierOrgId: ctx.orgId } }),
      db.rfqRecipient.count({
        where: {
          supplierOrgId: ctx.orgId,
          status: { in: ["SENT", "VIEWED"] },
          rfq: { status: "OPEN" },
        },
      }),
      db.quote.count({ where: { supplierOrgId: ctx.orgId } }),
      db.product.count({ where: { orgId: ctx.orgId, isActive: true } }),
    ]);
    return {
      kind: "supplier" as const,
      orders,
      openOrders,
      total: Number(revenue._sum.totalAmount ?? 0),
      unread,
      inbox,
      toQuote,
      quotes,
      products,
    };
  }
  const [rfqs, openRfqs, quotesReceived] = await Promise.all([
    db.rfq.count({ where: { buyerOrgId: ctx.orgId } }),
    db.rfq.count({ where: { buyerOrgId: ctx.orgId, status: "OPEN" } }),
    db.quote.count({ where: { rfq: { buyerOrgId: ctx.orgId }, status: "SUBMITTED" } }),
  ]);
  return {
    kind: "buyer" as const,
    orders,
    openOrders,
    total: Number(revenue._sum.totalAmount ?? 0),
    unread,
    rfqs,
    openRfqs,
    quotesReceived,
  };
}

/**
 * "Regular materials" for a buying organization: what it orders most often, from its own order
 * history. Nothing extra is stored, and it can only ever read this organization's own orders.
 */
export async function regularMaterialsFor(ctx: Ctx) {
  const rows = await db.orderItem.findMany({
    where: { order: { buyerOrgId: ctx.orgId, status: { not: "CANCELLED" } } },
    orderBy: { order: { createdAt: "desc" } },
    take: 300,
    select: {
      name: true,
      productId: true,
      quantity: true,
      unitCode: true,
      unitPrice: true,
      order: {
        select: {
          id: true,
          createdAt: true,
          supplierOrg: { select: { id: true, name: true } },
        },
      },
    },
  });
  return regularMaterials(
    rows.map((r) => ({
      orderId: r.order.id,
      orderedAt: r.order.createdAt,
      supplierOrgId: r.order.supplierOrg.id,
      supplierName: r.order.supplierOrg.name,
      name: r.name,
      productId: r.productId,
      quantity: Number(r.quantity.toString()),
      unitCode: r.unitCode,
      unitPrice: Number(r.unitPrice.toString()),
    })),
    8,
  );
}
