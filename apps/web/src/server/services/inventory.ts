import { z } from "zod";
import { db, Prisma } from "@bmn/database";
import { assertCan, assertOrgType, assertVerified, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { fieldErrorsFrom } from "./accounts";
import { audit } from "./notify";
import {
  applyMovement,
  fromMilli,
  isLow,
  statusFor,
  StockError,
  toMilli,
  type MovementKind,
} from "../stock-math";

type Tx = Prisma.TransactionClient;
const D = (milli: number) => new Prisma.Decimal(fromMilli(milli).toFixed(3));
const M = (d: { toString(): string }) => toMilli(Number(d.toString()));

function guard(ctx: Ctx) {
  assertOrgType(ctx, "SUPPLIER", "STORE");
  assertCan(ctx, "inventory.manage");
  assertVerified(ctx);
}

/** Orgs start with no branch. Create a default branch + warehouse the first time it is needed. */
export async function ensureWarehouse(ctx: Ctx, tx: Tx | typeof db = db) {
  const existing = await tx.warehouse.findFirst({
    where: { branch: { orgId: ctx.orgId } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (existing) return existing;
  return tx.warehouse.create({
    data: { name: "Main warehouse", branch: { create: { orgId: ctx.orgId, name: "Main" } } },
    select: { id: true, name: true },
  });
}

async function ownedWarehouse(ctx: Ctx, tx: Tx, warehouseId?: string) {
  if (!warehouseId) return ensureWarehouse(ctx, tx);
  const w = await tx.warehouse.findFirst({
    where: { id: warehouseId, branch: { orgId: ctx.orgId } },
    select: { id: true, name: true },
  });
  if (!w) throw new AppError("Warehouse not found.", "NOT_FOUND");
  return w;
}

/** Keeps the marketplace stockStatus honest. ON_REQUEST is a deliberate seller choice; leave it. */
async function syncProductStatus(tx: Tx, orgId: string, productId: string) {
  const product = await tx.product.findFirst({
    where: { id: productId, orgId },
    select: { stockStatus: true },
  });
  if (!product || product.stockStatus === "ON_REQUEST") return;
  const items = await tx.inventoryItem.findMany({
    where: { orgId, productId },
    select: { onHand: true, reserved: true, reorderLevel: true },
  });
  const avail = items.reduce((s, i) => s + M(i.onHand) - M(i.reserved), 0);
  const reorder = items.reduce((s, i) => s + M(i.reorderLevel), 0);
  const next = statusFor(avail, reorder);
  if (next !== product.stockStatus)
    await tx.product.update({ where: { id: productId }, data: { stockStatus: next } });
}

export const movementSchema = z.object({
  productId: z.string().min(1, "Choose a product"),
  warehouseId: z.string().optional().default(""),
  quantity: z.coerce.number().min(0, "Enter a quantity").max(1e9),
  unitCost: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().min(0).max(1e9).optional(),
  ),
  reference: z.string().trim().max(120).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});
export type MovementInput = z.infer<typeof movementSchema>;

/** Every stock change runs here: lock-free but Serializable, so concurrent issues cannot oversell. */
export async function move(ctx: Ctx, kind: MovementKind, raw: unknown) {
  guard(ctx);
  const parsed = movementSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError("Please fix the highlighted fields.", "VALIDATION", fieldErrorsFrom(parsed.error));
  const d = parsed.data;

  try {
    const result = await db.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: d.productId, orgId: ctx.orgId },
          select: { id: true, name: true },
        });
        if (!product) throw new AppError("Product not found.", "NOT_FOUND");
        const wh = await ownedWarehouse(ctx, tx, d.warehouseId || undefined);

        const item =
          (await tx.inventoryItem.findUnique({
            where: { warehouseId_productId: { warehouseId: wh.id, productId: product.id } },
          })) ??
          (await tx.inventoryItem.create({
            data: { orgId: ctx.orgId, warehouseId: wh.id, productId: product.id },
          }));

        const { balance, onHandDelta, reservedDelta } = applyMovement(
          { onHand: M(item.onHand), reserved: M(item.reserved) },
          kind,
          toMilli(d.quantity),
        );
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { onHand: D(balance.onHand), reserved: D(balance.reserved) },
        });
        await tx.stockMovement.create({
          data: {
            orgId: ctx.orgId,
            warehouseId: wh.id,
            productId: product.id,
            type: kind,
            onHandDelta: D(onHandDelta),
            reservedDelta: D(reservedDelta),
            onHandAfter: D(balance.onHand),
            unitCost: kind === "RECEIPT" && d.unitCost != null ? d.unitCost : null,
            reference: d.reference || null,
            note: d.note || null,
            actorId: ctx.userId,
          },
        });
        await syncProductStatus(tx, ctx.orgId, product.id);
        return { productName: product.name, onHand: fromMilli(balance.onHand) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await audit({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: `inventory.${kind.toLowerCase()}`,
      entity: "Product",
      entityId: d.productId,
      meta: { quantity: d.quantity, reference: d.reference || undefined },
    });
    return result;
  } catch (e) {
    if (e instanceof StockError) throw new AppError(e.message, "VALIDATION", { quantity: e.message });
    throw e;
  }
}

export const receiveStock = (ctx: Ctx, raw: unknown) => move(ctx, "RECEIPT", raw);
export const issueStock = (ctx: Ctx, raw: unknown) => move(ctx, "ISSUE", raw);
export const adjustStock = (ctx: Ctx, raw: unknown) => move(ctx, "ADJUSTMENT", raw);
export const reserveStock = (ctx: Ctx, raw: unknown) => move(ctx, "RESERVE", raw);
export const releaseStock = (ctx: Ctx, raw: unknown) => move(ctx, "RELEASE", raw);

export async function setReorderLevel(ctx: Ctx, productId: string, warehouseId: string | undefined, level: number) {
  guard(ctx);
  if (!Number.isFinite(level) || level < 0 || level > 1e9)
    throw new AppError("Enter a reorder level of 0 or more.", "VALIDATION", { reorderLevel: "Enter 0 or more" });
  await db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, orgId: ctx.orgId }, select: { id: true } });
    if (!product) throw new AppError("Product not found.", "NOT_FOUND");
    const wh = await ownedWarehouse(ctx, tx, warehouseId);
    await tx.inventoryItem.upsert({
      where: { warehouseId_productId: { warehouseId: wh.id, productId } },
      update: { reorderLevel: D(toMilli(level)) },
      create: { orgId: ctx.orgId, warehouseId: wh.id, productId, reorderLevel: D(toMilli(level)) },
    });
    await syncProductStatus(tx, ctx.orgId, productId);
  });
}

export type StockRow = {
  productId: string;
  name: string;
  sku: string | null;
  unit: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderLevel: number;
  low: boolean;
};

/** One row per product (summed across warehouses). Products with no stock record show zero. */
export async function listStock(ctx: Ctx, opts: { q?: string; lowOnly?: boolean } = {}): Promise<StockRow[]> {
  guard(ctx);
  const products = await db.product.findMany({
    where: {
      orgId: ctx.orgId,
      isActive: true,
      ...(opts.q ? { OR: [{ name: { contains: opts.q, mode: "insensitive" } }, { sku: { contains: opts.q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { name: "asc" },
    take: 500,
    select: {
      id: true,
      name: true,
      sku: true,
      unitCode: true,
      inventory: { where: { orgId: ctx.orgId }, select: { onHand: true, reserved: true, reorderLevel: true } },
    },
  });
  const rows = products.map((p) => {
    const onHand = p.inventory.reduce((s, i) => s + M(i.onHand), 0);
    const reserved = p.inventory.reduce((s, i) => s + M(i.reserved), 0);
    const reorder = p.inventory.reduce((s, i) => s + M(i.reorderLevel), 0);
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unit: p.unitCode,
      onHand: fromMilli(onHand),
      reserved: fromMilli(reserved),
      available: fromMilli(onHand - reserved),
      reorderLevel: fromMilli(reorder),
      low: isLow({ onHand, reserved }, reorder),
    };
  });
  return opts.lowOnly ? rows.filter((r) => r.low) : rows;
}

export async function listMovements(ctx: Ctx, opts: { productId?: string; take?: number } = {}) {
  guard(ctx);
  return db.stockMovement.findMany({
    where: { orgId: ctx.orgId, ...(opts.productId ? { productId: opts.productId } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.take ?? 50, 200),
    include: { product: { select: { name: true, unitCode: true } }, warehouse: { select: { name: true } } },
  });
}
