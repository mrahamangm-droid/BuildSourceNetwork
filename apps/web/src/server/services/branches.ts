import { z } from "zod";
import { db, Prisma } from "@bmn/database";
import { assertCan, assertOrgType, assertVerified, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { fieldErrorsFrom } from "./accounts";
import { audit } from "./notify";
import { moveInTx } from "./inventory";
import { StockError, toMilli } from "../stock-math";
import {
  MAX_BRANCHES,
  MAX_WAREHOUSES_PER_BRANCH,
  transferBlocker,
  warehouseDeleteBlocker,
  warehouseLabel,
} from "@/lib/branches";

function view(ctx: Ctx) {
  assertOrgType(ctx, "SUPPLIER", "STORE");
  assertCan(ctx, "inventory.manage");
}
function manage(ctx: Ctx) {
  assertOrgType(ctx, "SUPPLIER", "STORE");
  assertCan(ctx, "org.manage");
  assertVerified(ctx);
}

const valid = (e: z.ZodError) =>
  new AppError("Please fix the highlighted fields.", "VALIDATION", fieldErrorsFrom(e));

export const branchSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  city: z.string().trim().max(80).optional().default(""),
  address: z.string().trim().max(200).optional().default(""),
});
const nameSchema = z.object({ name: z.string().trim().min(2, "Enter a name").max(80) });

export async function listBranches(ctx: Ctx) {
  view(ctx);
  const [branches, stocked, moves, orderLines] = await Promise.all([
    db.branch.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "asc" },
      include: { warehouses: { orderBy: { createdAt: "asc" } } },
    }),
    db.inventoryItem.groupBy({
      by: ["warehouseId"],
      where: { orgId: ctx.orgId, onHand: { gt: 0 } },
      _count: { _all: true },
    }),
    db.stockMovement.groupBy({
      by: ["warehouseId"],
      where: { orgId: ctx.orgId },
      _count: { _all: true },
    }),
    db.orderItem.groupBy({
      by: ["stockWarehouseId"],
      where: { stockWarehouseId: { not: null }, order: { supplierOrgId: ctx.orgId } },
      _count: { _all: true },
    }),
  ]);
  const stockedBy = new Map(stocked.map((r) => [r.warehouseId, r._count._all]));
  const movesBy = new Map(moves.map((r) => [r.warehouseId, r._count._all]));
  const linesBy = new Map(orderLines.map((r) => [r.stockWarehouseId, r._count._all]));
  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    city: b.city,
    address: b.address,
    warehouses: b.warehouses.map((w) => ({
      id: w.id,
      name: w.name,
      stockedProducts: stockedBy.get(w.id) ?? 0,
      movements: movesBy.get(w.id) ?? 0,
      orderLines: linesBy.get(w.id) ?? 0,
    })),
  }));
}

/** Flat list for selects. */
export async function listWarehouseOptions(ctx: Ctx) {
  view(ctx);
  const rows = await db.warehouse.findMany({
    where: { branch: { orgId: ctx.orgId } },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, name: true, branch: { select: { name: true } } },
  });
  return rows.map((w) => ({ id: w.id, label: warehouseLabel(w.branch.name, w.name) }));
}

export async function createBranch(ctx: Ctx, raw: unknown) {
  manage(ctx);
  const p = branchSchema.safeParse(raw);
  if (!p.success) throw valid(p.error);
  const b = await db.$transaction(
    async (tx) => {
      if ((await tx.branch.count({ where: { orgId: ctx.orgId } })) >= MAX_BRANCHES)
        throw new AppError(`You can have at most ${MAX_BRANCHES} branches.`, "CONFLICT");
      return tx.branch.create({
        data: {
          orgId: ctx.orgId,
          name: p.data.name,
          city: p.data.city || null,
          address: p.data.address || null,
          warehouses: { create: { name: "Main warehouse" } },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "branch.created",
    entity: "Branch",
    entityId: b.id,
  });
  return b;
}

async function ownedBranch(ctx: Ctx, id: string) {
  const b = await db.branch.findFirst({ where: { id, orgId: ctx.orgId }, select: { id: true } });
  if (!b) throw new AppError("Branch not found.", "NOT_FOUND");
  return b;
}

export async function updateBranch(ctx: Ctx, id: string, raw: unknown) {
  manage(ctx);
  await ownedBranch(ctx, id);
  const p = branchSchema.safeParse(raw);
  if (!p.success) throw valid(p.error);
  await db.branch.update({
    where: { id },
    data: { name: p.data.name, city: p.data.city || null, address: p.data.address || null },
  });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "branch.updated",
    entity: "Branch",
    entityId: id,
  });
}

async function warehouseFacts(orgId: string, warehouseId: string) {
  const [items, movements, orderLines] = await Promise.all([
    db.inventoryItem.findMany({
      where: { orgId, warehouseId },
      select: { onHand: true, reserved: true },
    }),
    db.stockMovement.count({ where: { orgId, warehouseId } }),
    db.orderItem.count({ where: { stockWarehouseId: warehouseId } }),
  ]);
  return {
    movements,
    orderLines,
    onHandMilli: items.reduce((s, i) => s + toMilli(Number(i.onHand.toString())), 0),
    reservedMilli: items.reduce((s, i) => s + toMilli(Number(i.reserved.toString())), 0),
  };
}

export async function deleteBranch(ctx: Ctx, id: string) {
  manage(ctx);
  await ownedBranch(ctx, id);
  const whs = await db.warehouse.findMany({
    where: { branchId: id },
    select: { id: true, name: true },
  });
  for (const w of whs) {
    const why = warehouseDeleteBlocker(await warehouseFacts(ctx.orgId, w.id));
    if (why) throw new AppError(`Cannot delete this branch: "${w.name}" — ${why}`, "CONFLICT");
  }
  await db.branch.delete({ where: { id } });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "branch.deleted",
    entity: "Branch",
    entityId: id,
  });
}

export async function addWarehouse(ctx: Ctx, branchId: string, raw: unknown) {
  manage(ctx);
  await ownedBranch(ctx, branchId);
  const p = nameSchema.safeParse(raw);
  if (!p.success) throw valid(p.error);
  const w = await db.$transaction(
    async (tx) => {
      if ((await tx.warehouse.count({ where: { branchId } })) >= MAX_WAREHOUSES_PER_BRANCH)
        throw new AppError(
          `A branch can have at most ${MAX_WAREHOUSES_PER_BRANCH} warehouses.`,
          "CONFLICT",
        );
      return tx.warehouse.create({ data: { branchId, name: p.data.name } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "warehouse.created",
    entity: "Warehouse",
    entityId: w.id,
  });
  return w;
}

export async function deleteWarehouse(ctx: Ctx, warehouseId: string) {
  manage(ctx);
  const w = await db.warehouse.findFirst({
    where: { id: warehouseId, branch: { orgId: ctx.orgId } },
    select: { id: true },
  });
  if (!w) throw new AppError("Warehouse not found.", "NOT_FOUND");
  const why = warehouseDeleteBlocker(await warehouseFacts(ctx.orgId, warehouseId));
  if (why) throw new AppError(`Cannot delete this warehouse. ${why}`, "CONFLICT");
  await db.warehouse.delete({ where: { id: warehouseId } });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "warehouse.deleted",
    entity: "Warehouse",
    entityId: warehouseId,
  });
}

export const transferSchema = z.object({
  productId: z.string().min(1, "Choose a product"),
  fromWarehouseId: z.string().min(1, "Choose the source"),
  toWarehouseId: z.string().min(1, "Choose the destination"),
  quantity: z.coerce.number().max(1e9),
  note: z.string().trim().max(300).optional().default(""),
});

/**
 * Moves stock between two of the seller's own warehouses as an ISSUE + RECEIPT pair in one
 * Serializable transaction, so it either happens fully or not at all. Only available (unreserved)
 * stock can be transferred; the ledger shows both legs with a shared reference.
 */
export async function transferStock(ctx: Ctx, raw: unknown) {
  view(ctx);
  assertVerified(ctx);
  const p = transferSchema.safeParse(raw);
  if (!p.success) throw valid(p.error);
  const d = p.data;
  const why = transferBlocker(d);
  if (why) throw new AppError(why, "VALIDATION", { quantity: why });

  const whs = await db.warehouse.findMany({
    where: { id: { in: [d.fromWarehouseId, d.toWarehouseId] }, branch: { orgId: ctx.orgId } },
    select: { id: true, name: true, branch: { select: { name: true } } },
  });
  const from = whs.find((w) => w.id === d.fromWarehouseId);
  const to = whs.find((w) => w.id === d.toWarehouseId);
  if (!from || !to) throw new AppError("Warehouse not found.", "NOT_FOUND");
  const ref =
    `Transfer ${warehouseLabel(from.branch.name, from.name)} → ${warehouseLabel(to.branch.name, to.name)}`.slice(
      0,
      120,
    );

  try {
    await db.$transaction(
      async (tx) => {
        const actor = { orgId: ctx.orgId, userId: ctx.userId };
        const base = { productId: d.productId, quantity: d.quantity, reference: ref, note: d.note };
        await moveInTx(tx, actor, "ISSUE", { ...base, warehouseId: from.id, unitCost: undefined });
        await moveInTx(tx, actor, "RECEIPT", { ...base, warehouseId: to.id, unitCost: undefined });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    if (e instanceof StockError)
      throw new AppError(e.message, "VALIDATION", { quantity: e.message });
    throw e;
  }
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "inventory.transfer",
    entity: "Product",
    entityId: d.productId,
    meta: { from: from.id, to: to.id, quantity: d.quantity },
  });
}
