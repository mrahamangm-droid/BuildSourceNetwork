import { db, Prisma } from "@bmn/database";
import { assertCan, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { audit } from "./notify";
import { moveInTx } from "./inventory";
import { StockError } from "../stock-math";
import {
  autoActionFor,
  nextState,
  RESERVABLE_ORDER_STATUSES,
  suggestProduct,
  type OrderStockAction,
} from "@/lib/order-stock";

type Tx = Prisma.TransactionClient;
type Actor = { orgId: string; userId: string | null };

const SERIAL = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

function guard(ctx: Ctx) {
  assertCan(ctx, "inventory.manage");
}

async function supplierOrder(tx: Tx | typeof db, orgId: string, orderId: string) {
  const order = await tx.order.findFirst({
    where: { id: orderId, supplierOrgId: orgId },
    include: { items: true },
  });
  if (!order) throw new AppError("Order not found", "NOT_FOUND");
  return order;
}

function asAppError(e: unknown, productName?: string): never {
  if (e instanceof StockError)
    throw new AppError(productName ? `${productName}: ${e.message}` : e.message, "VALIDATION");
  throw e;
}

type OrderWithItems = Awaited<ReturnType<typeof supplierOrder>>;

/** Releases (and for "issue", then issues) every RESERVED line. Returns how many lines changed. */
async function transition(tx: Tx, actor: Actor, order: OrderWithItems, action: "issue" | "release", note: string) {
  let changed = 0;
  for (const item of order.items) {
    const target = nextState(item.stockState, action);
    if (!target || !item.productId) continue;
    const qty = Number(item.quantity.toString());
    const base = {
      productId: item.productId,
      warehouseId: item.stockWarehouseId ?? "",
      quantity: qty,
      unitCost: undefined,
      reference: order.number,
      note,
    };
    try {
      // An issue consumes the reservation first, then removes the goods: the ledger shows both.
      await moveInTx(tx, actor, "RELEASE", base);
      if (action === "issue") await moveInTx(tx, actor, "ISSUE", base);
    } catch (e) {
      asAppError(e, item.name);
    }
    await tx.orderItem.update({ where: { id: item.id }, data: { stockState: target } });
    changed++;
  }
  return changed;
}

/** Everything the panel needs for one order: lines, their stock state and a suggested product. */
export async function getOrderStock(ctx: Ctx, orderId: string) {
  guard(ctx);
  const order = await supplierOrder(db, ctx.orgId, orderId);
  const products = await db.product.findMany({
    where: { orgId: ctx.orgId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unitCode: true },
    take: 500,
  });
  return {
    canReserve: (RESERVABLE_ORDER_STATUSES as readonly string[]).includes(order.status),
    products,
    lines: order.items.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity.toString(),
      unitCode: i.unitCode,
      state: i.stockState,
      productId: i.productId ?? suggestProduct({ name: i.name, unitCode: i.unitCode }, products),
      productName: products.find((p) => p.id === i.productId)?.name ?? null,
    })),
  };
}

/** mapping: order item id -> the supplier's product id. Lines left blank are skipped. */
export async function reserveOrderStock(ctx: Ctx, orderId: string, mapping: Record<string, string>) {
  guard(ctx);
  const n = await db.$transaction(async (tx) => {
    const order = await supplierOrder(tx, ctx.orgId, orderId);
    if (!(RESERVABLE_ORDER_STATUSES as readonly string[]).includes(order.status))
      throw new AppError("Stock can be reserved once the order is confirmed and until it is dispatched.", "FORBIDDEN");
    let done = 0;
    for (const item of order.items) {
      const productId = mapping[item.id];
      if (!productId || !nextState(item.stockState, "reserve")) continue;
      const product = await tx.product.findFirst({
        where: { id: productId, orgId: ctx.orgId },
        select: { id: true, name: true, unitCode: true },
      });
      if (!product) throw new AppError("Product not found.", "NOT_FOUND");
      if (product.unitCode !== item.unitCode)
        throw new AppError(
          `${item.name} is ordered in ${item.unitCode}, but ${product.name} is stocked in ${product.unitCode}. Pick a product with the same unit.`,
          "VALIDATION",
        );
      let res;
      try {
        res = await moveInTx(tx, ctx, "RESERVE", {
          productId: product.id,
          warehouseId: "",
          quantity: Number(item.quantity.toString()),
          unitCost: undefined,
          reference: order.number,
          note: `Reserved for order ${order.number}`,
        });
      } catch (e) {
        asAppError(e, product.name);
      }
      await tx.orderItem.update({
        where: { id: item.id },
        data: { productId: product.id, stockWarehouseId: res.warehouseId, stockState: "RESERVED" },
      });
      done++;
    }
    if (!done)
      throw new AppError("Choose a product for at least one line that is not already reserved.", "VALIDATION");
    return done;
  }, SERIAL);
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "order.stock_reserved",
    entity: "Order",
    entityId: orderId,
    meta: { lines: n },
  });
  return n;
}

async function manual(ctx: Ctx, orderId: string, action: "issue" | "release") {
  guard(ctx);
  const n = await db.$transaction(async (tx) => {
    const order = await supplierOrder(tx, ctx.orgId, orderId);
    if (action === "issue" && order.status === "CANCELLED")
      throw new AppError("This order is cancelled. Release the reservation instead.", "FORBIDDEN");
    const changed = await transition(tx, ctx, order, action, `${action === "issue" ? "Issued" : "Released"} for order ${order.number}`);
    if (!changed) throw new AppError("There is no reserved stock on this order.", "VALIDATION");
    return changed;
  }, SERIAL);
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: `order.stock_${action}d`,
    entity: "Order",
    entityId: orderId,
    meta: { lines: n },
  });
  return n;
}

export const issueOrderStock = (ctx: Ctx, orderId: string) => manual(ctx, orderId, "issue");
export const releaseOrderStock = (ctx: Ctx, orderId: string) => manual(ctx, orderId, "release");

/**
 * Called after an order changes status. Dispatch issues reserved goods; cancellation releases them.
 * Idempotent (only RESERVED lines move) and deliberately non-fatal: a stock problem must never
 * block an order from progressing, so failures are logged and audited, and the supplier can retry
 * from the order page.
 */
export async function syncOrderStock(orderId: string, orderStatus: string) {
  const action = autoActionFor(orderStatus);
  if (!action) return;
  const order0 = await db.order.findUnique({ where: { id: orderId }, select: { supplierOrgId: true } });
  if (!order0) return;
  const actor: Actor = { orgId: order0.supplierOrgId, userId: null };
  try {
    const n = await db.$transaction(async (tx) => {
      const order = await supplierOrder(tx, actor.orgId, orderId);
      return transition(tx, actor, order, action, `Automatic: order ${orderStatus.toLowerCase()}`);
    }, SERIAL);
    if (n)
      await audit({
        orgId: actor.orgId,
        action: `order.stock_${action}d_auto`,
        entity: "Order",
        entityId: orderId,
        meta: { lines: n, orderStatus },
      });
  } catch (e) {
    console.error("[order-stock] automatic sync failed", orderId, e instanceof Error ? e.message : e);
    await audit({
      orgId: actor.orgId,
      action: "order.stock_sync_failed",
      entity: "Order",
      entityId: orderId,
      meta: { orderStatus },
    }).catch(() => {});
  }
}

export type { OrderStockAction };
