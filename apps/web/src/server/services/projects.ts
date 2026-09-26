import { z } from "zod";
import { db, Prisma } from "@bmn/database";
import { assertBuyer, assertCan, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { fieldErrorsFrom } from "./accounts";
import { audit } from "./notify";
import { isDeliveredStatus, pipeline, supplierSplit } from "@/lib/procurement";
import { importLinesSchema, parseBoqList } from "@/lib/boq-import";
import { hit } from "../rate-limit";
import {
  boqCsv,
  MAX_ITEMS_PER_PROJECT,
  PROJECT_KINDS,
  PROJECT_STATUSES,
  starterBoq,
  summarize,
  type ProjectKind,
} from "@/lib/boq";

function guard(ctx: Ctx) {
  assertBuyer(ctx);
  assertCan(ctx, "project.manage");
}

function parse<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const r = schema.safeParse(raw);
  if (!r.success)
    throw new AppError(
      "Please fix the highlighted fields.",
      "VALIDATION",
      fieldErrorsFrom(r.error),
    );
  return r.data;
}

const optMoney = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : Number(v)))
  .pipe(z.number().min(0, "Cannot be negative").max(1e11, "Too large").nullable());

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Enter a project name").max(120),
  kind: z.enum(PROJECT_KINDS),
  status: z.enum(PROJECT_STATUSES).default("PLANNING"),
  city: z.string().trim().max(80).optional().default(""),
  startDate: z
    .string()
    .optional()
    .default("")
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Enter a valid date"),
  budget: optMoney,
  notes: z.string().trim().max(2000).optional().default(""),
});

export const itemSchema = z.object({
  section: z.string().trim().min(1, "Enter a section").max(60),
  description: z.string().trim().min(2, "Describe the item").max(200),
  unit: z.string().trim().min(1, "Enter a unit").max(16),
  quantity: z.coerce.number({ message: "Enter a quantity" }).gt(0, "Must be above 0").max(1e9),
  wastePercent: z.coerce.number().min(0, "0 to 100").max(100, "0 to 100").default(0),
  unitRate: optMoney,
});

export const itemUpdateSchema = itemSchema.pick({
  quantity: true,
  wastePercent: true,
  unitRate: true,
});

const num = (d: { toString(): string } | null) => (d === null ? null : Number(d.toString()));

function shapeItem(i: {
  id: string;
  section: string;
  description: string;
  unit: string;
  quantity: Prisma.Decimal;
  wastePercent: Prisma.Decimal;
  unitRate: Prisma.Decimal | null;
}) {
  return {
    id: i.id,
    section: i.section,
    description: i.description,
    unit: i.unit,
    quantity: Number(i.quantity.toString()),
    wastePercent: Number(i.wastePercent.toString()),
    unitRate: num(i.unitRate),
  };
}

export async function own(ctx: Ctx, id: string) {
  const p = await db.project.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!p) throw new AppError("Project not found", "NOT_FOUND");
  return p;
}

export async function createProject(ctx: Ctx, raw: unknown) {
  guard(ctx);
  const d = parse(projectSchema, raw);
  const p = await db.project.create({
    data: {
      orgId: ctx.orgId,
      name: d.name,
      kind: d.kind,
      status: d.status,
      city: d.city || null,
      startDate: d.startDate ? new Date(d.startDate) : null,
      budget: d.budget,
      notes: d.notes || null,
    },
  });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "project.created",
    entity: "Project",
    entityId: p.id,
  });
  return p;
}

export async function updateProject(ctx: Ctx, id: string, raw: unknown) {
  guard(ctx);
  await own(ctx, id);
  const d = parse(projectSchema, raw);
  const p = await db.project.update({
    where: { id },
    data: {
      name: d.name,
      kind: d.kind,
      status: d.status,
      city: d.city || null,
      startDate: d.startDate ? new Date(d.startDate) : null,
      budget: d.budget,
      notes: d.notes || null,
    },
  });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "project.updated",
    entity: "Project",
    entityId: id,
  });
  return p;
}

export async function listProjects(ctx: Ctx) {
  guard(ctx);
  const rows = await db.project.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { items: { select: { quantity: true, wastePercent: true, unitRate: true } } },
  });
  return rows.map((p) => {
    const s = summarize(
      p.items.map((i) => ({
        section: "",
        quantity: Number(i.quantity.toString()),
        wastePercent: Number(i.wastePercent.toString()),
        unitRate: num(i.unitRate),
      })),
      num(p.budget),
    );
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      status: p.status,
      city: p.city,
      budget: num(p.budget),
      itemCount: s.itemCount,
      totalCents: s.totalCents,
      unpriced: s.unpriced,
    };
  });
}

export async function getProject(ctx: Ctx, id: string) {
  guard(ctx);
  const p = await db.project.findFirst({
    where: { id, orgId: ctx.orgId },
    include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  if (!p) return null;
  const items = p.items.map(shapeItem);
  return {
    project: {
      id: p.id,
      name: p.name,
      kind: p.kind as ProjectKind,
      status: p.status,
      city: p.city,
      startDate: p.startDate,
      budget: num(p.budget),
      notes: p.notes,
    },
    summary: summarize(items, num(p.budget)),
  };
}

/** Appends an item, guarded by a per-project cap. Serializable so two tabs cannot exceed it. */
export async function appendItems(
  ctx: Ctx,
  projectId: string,
  rows: {
    section: string;
    description: string;
    unit: string;
    quantity: number;
    wastePercent: number;
    unitRate: number | null;
  }[],
) {
  return db.$transaction(
    async (tx) => {
      const last = await tx.boqItem.aggregate({
        where: { projectId, orgId: ctx.orgId },
        _count: true,
        _max: { sortOrder: true },
      });
      if (last._count + rows.length > MAX_ITEMS_PER_PROJECT)
        throw new AppError(
          `A project can hold at most ${MAX_ITEMS_PER_PROJECT} BOQ lines.`,
          "VALIDATION",
        );
      let order = (last._max.sortOrder ?? -1) + 1;
      await tx.boqItem.createMany({
        data: rows.map((r) => ({
          projectId,
          orgId: ctx.orgId,
          section: r.section,
          description: r.description,
          unit: r.unit,
          quantity: r.quantity.toFixed(3),
          wastePercent: r.wastePercent.toFixed(2),
          unitRate: r.unitRate === null ? null : r.unitRate.toFixed(2),
          sortOrder: order++,
        })),
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function addItem(ctx: Ctx, projectId: string, raw: unknown) {
  guard(ctx);
  await own(ctx, projectId);
  const d = parse(itemSchema, raw);
  await appendItems(ctx, projectId, [d]);
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "boq.item_added",
    entity: "Project",
    entityId: projectId,
  });
}

export async function updateItem(ctx: Ctx, itemId: string, raw: unknown) {
  guard(ctx);
  const d = parse(itemUpdateSchema, raw);
  const res = await db.boqItem.updateMany({
    where: { id: itemId, orgId: ctx.orgId },
    data: {
      quantity: d.quantity.toFixed(3),
      wastePercent: d.wastePercent.toFixed(2),
      unitRate: d.unitRate === null ? null : d.unitRate.toFixed(2),
    },
  });
  if (res.count !== 1) throw new AppError("Line not found", "NOT_FOUND");
}

export async function deleteItem(ctx: Ctx, itemId: string) {
  guard(ctx);
  const res = await db.boqItem.deleteMany({ where: { id: itemId, orgId: ctx.orgId } });
  if (res.count !== 1) throw new AppError("Line not found", "NOT_FOUND");
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "boq.item_deleted",
    entity: "BoqItem",
    entityId: itemId,
  });
}

const starterSchema = z.object({
  areaM2: z.coerce
    .number({ message: "Enter the gross floor area" })
    .gt(0, "Must be above 0")
    .max(1_000_000),
  floors: z.coerce
    .number({ message: "Enter the number of floors" })
    .int("Whole floors only")
    .min(1)
    .max(100),
});

/** Adds rule-based starter lines (no rates) using the project's kind. */
export async function generateStarter(ctx: Ctx, projectId: string, raw: unknown) {
  guard(ctx);
  const p = await own(ctx, projectId);
  const d = parse(starterSchema, raw);
  const lines = starterBoq(p.kind as ProjectKind, d.areaM2, d.floors);
  if (!lines.length)
    throw new AppError(
      "Set the project type to a building type (villa, apartment building or warehouse) to generate a starter bill.",
      "VALIDATION",
      { areaM2: "Starter bills are available for building projects only." },
    );
  await appendItems(
    ctx,
    projectId,
    lines.map((l) => ({ ...l, unitRate: null })),
  );
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "boq.starter_generated",
    entity: "Project",
    entityId: projectId,
    meta: { areaM2: d.areaM2, floors: d.floors, lines: lines.length },
  });
  return lines.length;
}

export async function exportCsv(ctx: Ctx, projectId: string) {
  guard(ctx);
  const p = await own(ctx, projectId);
  const items = await db.boqItem.findMany({
    where: { projectId, orgId: ctx.orgId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return { name: p.name, csv: boqCsv(items.map(shapeItem)) };
}

/**
 * Procurement trail of one project: the RFQs raised from its BOQ, the quotes they attracted, the
 * orders that came out of them and how far those have been delivered. Org-scoped.
 */
export async function getProcurement(ctx: Ctx, projectId: string) {
  guard(ctx);
  await own(ctx, projectId);
  const [boqLines, rfqs] = await Promise.all([
    db.boqItem.count({ where: { projectId, orgId: ctx.orgId } }),
    db.rfq.findMany({
      where: { projectId, buyerOrgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        createdAt: true,
        _count: { select: { quotes: true } },
        orders: {
          select: {
            id: true,
            number: true,
            status: true,
            totalAmount: true,
            currency: true,
            supplierOrg: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);
  const orders = rfqs.flatMap((r) =>
    r.orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status as string,
      total: Number(o.totalAmount.toString()),
      currency: o.currency,
      supplierOrgId: o.supplierOrg.id,
      supplierName: o.supplierOrg.name,
      delivered: isDeliveredStatus(o.status),
    })),
  );
  const input = {
    boqLines,
    rfqs: rfqs.map((r) => ({ status: r.status as string, quoteCount: r._count.quotes })),
    orders,
  };
  return {
    stages: pipeline(input),
    split: supplierSplit(orders),
    rfqs: rfqs.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      status: r.status as string,
      quoteCount: r._count.quotes,
      createdAt: r.createdAt,
    })),
    orders,
  };
}

// ───────────────────────── BOQ / material-list import ─────────────────────────

/** Step 1: read a pasted list or uploaded CSV/TSV/TXT into draft lines. Saves nothing. */
export async function previewImport(ctx: Ctx, projectId: string, text: string) {
  guard(ctx);
  await own(ctx, projectId);
  const rl = hit(`boq-import:${ctx.userId}`, 20, 60_000);
  if (!rl.ok)
    throw new AppError(`Slow down: try again in ${rl.retryAfterSec} seconds.`, "RATE_LIMIT");
  if (!text.trim())
    throw new AppError("Paste a list or choose a file first.", "VALIDATION", {
      text: "Paste a list or choose a file",
    });
  const r = parseBoqList(text);
  if (!r.lines.length)
    throw new AppError(
      "We could not find any lines with a quantity. Use columns like Item, Qty, Unit, or lines like “Cement 42.5N - 200 bags”.",
      "VALIDATION",
      { text: "No readable lines found" },
    );
  return r;
}

/** Step 2: save the lines the user reviewed. Re-validated on the server; the client is never trusted. */
export async function addImportedLines(ctx: Ctx, projectId: string, raw: unknown) {
  guard(ctx);
  await own(ctx, projectId);
  const parsed = importLinesSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(parsed.error.issues[0]?.message ?? "Select at least one line", "VALIDATION");
  await appendItems(
    ctx,
    projectId,
    parsed.data.map((l) => ({ ...l, unitRate: null })),
  );
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "boq.imported",
    entity: "Project",
    entityId: projectId,
    meta: { lines: parsed.data.length },
  });
  return parsed.data.length;
}
