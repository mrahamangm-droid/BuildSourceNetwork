import { z } from "zod";
import { db } from "@bmn/database";
import { ORDER_STATUS_LABEL } from "@bmn/config";
import { assertCan, assertVerified, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { fieldErrorsFrom } from "./accounts";
import { audit, notifyOrg } from "./notify";
import { syncOrderStock } from "./order-stock";
import {
  checkTransition,
  DELIVERABLE_ORDER_STATUSES,
  DELIVERY_LABEL,
  scheduleError,
  statusAfterDriverEdit,
  type DeliveryStatusValue,
} from "@/lib/delivery-rules";

const opt = (max: number) => z.string().trim().max(max).optional().default("");

export const deliverySchema = z.object({
  scheduledAt: z.string().min(1, "Choose a delivery date"),
  driverName: opt(80),
  driverPhone: opt(30),
  vehicle: opt(60),
  address: opt(300),
  notes: opt(500),
});
export type DeliveryInput = z.infer<typeof deliverySchema>;

export const proofSchema = z.object({
  recipientName: z.string().trim().min(2, "Enter who received the goods").max(80),
  proofUrl: opt(500),
  proofNote: opt(500),
});

function parse<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const r = schema.safeParse(raw);
  if (!r.success)
    throw new AppError("Please fix the highlighted fields.", "VALIDATION", fieldErrorsFrom(r.error));
  return r.data;
}

function parseWhen(s: string) {
  const when = new Date(s);
  const err = scheduleError(when);
  if (err) throw new AppError(err, "VALIDATION", { scheduledAt: err });
  return when;
}

/** Only the supplying org may manage deliveries on an order. */
async function supplierOrder(ctx: Ctx, orderId: string) {
  assertCan(ctx, "order.manage");
  assertVerified(ctx);
  const order = await db.order.findFirst({
    where: { id: orderId, supplierOrgId: ctx.orgId },
    select: { id: true, number: true, status: true, buyerOrgId: true, deliveryAddress: true, deliveryCity: true },
  });
  if (!order) throw new AppError("Order not found", "NOT_FOUND");
  return order;
}

async function supplierDelivery(ctx: Ctx, deliveryId: string) {
  assertCan(ctx, "order.manage");
  assertVerified(ctx);
  const d = await db.delivery.findFirst({
    where: { id: deliveryId, order: { supplierOrgId: ctx.orgId } },
    include: { order: { select: { id: true, number: true, status: true, buyerOrgId: true } } },
  });
  if (!d) throw new AppError("Delivery not found", "NOT_FOUND");
  return d;
}

const fmtWhen = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(d);

export async function scheduleDelivery(ctx: Ctx, orderId: string, raw: unknown) {
  const input = parse(deliverySchema, raw);
  const order = await supplierOrder(ctx, orderId);
  if (!(DELIVERABLE_ORDER_STATUSES as readonly string[]).includes(order.status))
    throw new AppError(
      `You can schedule deliveries once the order is confirmed (it is currently "${ORDER_STATUS_LABEL[order.status]}").`,
      "FORBIDDEN",
    );
  const when = parseWhen(input.scheduledAt);
  if ((await db.delivery.count({ where: { orderId } })) >= 20)
    throw new AppError("This order already has 20 deliveries.", "FORBIDDEN");

  const d = await db.delivery.create({
    data: {
      orderId,
      status: statusAfterDriverEdit("PENDING", input.driverName),
      scheduledAt: when,
      driverName: input.driverName || null,
      driverPhone: input.driverPhone || null,
      vehicle: input.vehicle || null,
      address: input.address || null,
      notes: input.notes || null,
    },
  });
  await audit({ orgId: ctx.orgId, actorId: ctx.userId, action: "delivery.schedule", entity: "Delivery", entityId: d.id });
  await notifyOrg({
    orgId: order.buyerOrgId,
    type: "delivery.scheduled",
    title: `Order ${order.number}: delivery scheduled for ${fmtWhen(when)}`,
    body: input.driverName ? `Driver: ${input.driverName}${input.vehicle ? ` (${input.vehicle})` : ""}` : undefined,
    href: `/dashboard/orders/${orderId}`,
  });
  return d;
}

/** Edit schedule or driver details while the delivery has not been completed. */
export async function updateDelivery(ctx: Ctx, deliveryId: string, raw: unknown) {
  const input = parse(deliverySchema, raw);
  const d = await supplierDelivery(ctx, deliveryId);
  if (d.status === "DELIVERED") throw new AppError("This delivery is already completed.", "FORBIDDEN");
  const when = parseWhen(input.scheduledAt);
  const res = await db.delivery.updateMany({
    where: { id: deliveryId, status: d.status },
    data: {
      scheduledAt: when,
      status: statusAfterDriverEdit(d.status as DeliveryStatusValue, input.driverName),
      driverName: input.driverName || null,
      driverPhone: input.driverPhone || null,
      vehicle: input.vehicle || null,
      address: input.address || null,
      notes: input.notes || null,
    },
  });
  if (res.count !== 1)
    throw new AppError("The delivery was updated by someone else. Refresh and try again.", "CONFLICT");
  await audit({ orgId: ctx.orgId, actorId: ctx.userId, action: "delivery.update", entity: "Delivery", entityId: deliveryId });
  await notifyOrg({
    orgId: d.order.buyerOrgId,
    type: "delivery.updated",
    title: `Order ${d.order.number}: delivery rescheduled for ${fmtWhen(when)}`,
    href: `/dashboard/orders/${d.order.id}`,
  });
}

/** Moves a delivery forward and keeps the order status in step, in one transaction. */
export async function advanceDelivery(
  ctx: Ctx,
  deliveryId: string,
  target: DeliveryStatusValue,
  rawProof?: unknown,
) {
  const d = await supplierDelivery(ctx, deliveryId);
  const proof = target === "DELIVERED" ? parse(proofSchema, rawProof) : null;
  const problem = checkTransition(
    { status: d.status as DeliveryStatusValue, driverName: d.driverName, recipientName: proof?.recipientName },
    target,
  );
  if (problem) throw new AppError(problem, "VALIDATION");
  if (target === "OUT_FOR_DELIVERY" && d.order.status === "CONFIRMED")
    throw new AppError('Mark the order as "Preparing" before sending a delivery out.', "FORBIDDEN");

  await db.$transaction(async (tx) => {
    const res = await tx.delivery.updateMany({
      where: { id: deliveryId, status: d.status },
      data:
        target === "OUT_FOR_DELIVERY"
          ? { status: target, dispatchedAt: new Date() }
          : target === "DELIVERED"
            ? {
                status: target,
                deliveredAt: new Date(),
                recipientName: proof!.recipientName,
                proofUrl: proof!.proofUrl || null,
                proofNote: proof!.proofNote || null,
              }
            : { status: target },
    });
    if (res.count !== 1)
      throw new AppError("The delivery was updated by someone else. Refresh and try again.", "CONFLICT");

    // Keep the order in step with its deliveries.
    if (target === "OUT_FOR_DELIVERY" && d.order.status === "PREPARING") {
      const o = await tx.order.updateMany({ where: { id: d.order.id, status: "PREPARING" }, data: { status: "DISPATCHED" } });
      if (o.count === 1)
        await tx.orderEvent.create({ data: { orderId: d.order.id, status: "DISPATCHED", actorId: ctx.userId, note: "Delivery out for delivery" } });
    }
    if (target === "DELIVERED" && d.order.status === "DISPATCHED") {
      const open = await tx.delivery.count({ where: { orderId: d.order.id, status: { not: "DELIVERED" } } });
      if (open === 0) {
        const o = await tx.order.updateMany({ where: { id: d.order.id, status: "DISPATCHED" }, data: { status: "DELIVERED" } });
        if (o.count === 1)
          await tx.orderEvent.create({ data: { orderId: d.order.id, status: "DELIVERED", actorId: ctx.userId, note: `Received by ${proof!.recipientName}` } });
      }
    }
  });

  // Sending a delivery out dispatches the order, so reserved goods leave stock (idempotent).
  if (target === "OUT_FOR_DELIVERY") await syncOrderStock(d.order.id, "DISPATCHED");
  await audit({ orgId: ctx.orgId, actorId: ctx.userId, action: `delivery.${target.toLowerCase()}`, entity: "Delivery", entityId: deliveryId });
  if (target !== "ASSIGNED")
    await notifyOrg({
      orgId: d.order.buyerOrgId,
      type: "delivery.status",
      title: `Order ${d.order.number}: ${DELIVERY_LABEL[target]}`,
      body: target === "DELIVERED" ? `Received by ${proof!.recipientName}. Please confirm receipt on the order page.` : undefined,
      href: `/dashboard/orders/${d.order.id}`,
    });
}

/** Deliveries the org is party to (as supplier or buyer), soonest first. */
export async function listDeliveries(ctx: Ctx, opts: { activeOnly?: boolean } = {}) {
  assertCan(ctx, "order.view");
  return db.delivery.findMany({
    where: {
      order: { OR: [{ supplierOrgId: ctx.orgId }, { buyerOrgId: ctx.orgId }] },
      ...(opts.activeOnly ? { status: { not: "DELIVERED" } } : {}),
    },
    orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 100,
    include: {
      order: {
        select: {
          id: true,
          number: true,
          supplierOrgId: true,
          deliveryCity: true,
          deliveryAddress: true,
          buyerOrg: { select: { name: true } },
          supplierOrg: { select: { name: true } },
        },
      },
    },
  });
}
