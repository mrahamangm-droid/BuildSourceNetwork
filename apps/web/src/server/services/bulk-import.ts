/**
 * Bulk product import engine.
 *
 * A file is parsed in the browser and its rows are staged in the database (ImportRow) in small
 * chunks, so nothing depends on one big request. Every later step works on a bounded batch and can
 * be repeated or resumed: rows are validated, matched to existing products, then applied in
 * transactional chunks with a per-row "before" snapshot that powers rollback. Progress is always
 * derived from row statuses, so counts cannot drift and no row is silently lost or applied twice.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, Prisma } from "@bmn/database";
import { slugify } from "@bmn/config";
import { assertCan, assertOrgType, assertVerified, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { audit, notifyOrg } from "./notify";
import { getEffectiveLimits } from "./plans";
import { hit } from "../rate-limit";
import { FIELDS, BULK_MAX_ROWS, REQUIRED_FIELDS, type FieldKey } from "@/lib/bulk/fields";
import { missingRequired, type ColumnMap } from "@/lib/bulk/mapping";
import {
  dedupeKey,
  missingForCreate,
  validateRow,
  type Refs,
  type RowIssue,
  type RowValues,
} from "@/lib/bulk/validate";
import { buildErrorReport, type ReportRow } from "@/lib/bulk/report";
import { buildProductTemplate } from "@/lib/bulk/template";

const SELLER_TYPES = ["SUPPLIER", "STORE"] as const;
export const STAGE_CHUNK_MAX = 1500;
const MAX_CELLS = 120;
const MAX_CELL_CHARS = 4000;
const LEASE_MS = 60_000;
const ROLLBACK_WINDOW_DAYS = 14;

function guard(ctx: Ctx) {
  assertCan(ctx, "product.manage");
  assertOrgType(ctx, ...SELLER_TYPES);
  assertVerified(ctx);
}

// ───────────────────────── reference data ─────────────────────────

let refsCache: { at: number; refs: Refs } | null = null;
export function resetBulkCaches() {
  refsCache = null;
}

export async function loadRefs(): Promise<Refs> {
  if (refsCache && Date.now() - refsCache.at < 60_000) return refsCache.refs;
  const [categories, subcategories, types, units] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true, slug: true } }),
    db.subcategory.findMany({ select: { id: true, categoryId: true, name: true, slug: true } }),
    db.productType.findMany({ select: { id: true, subcategoryId: true, name: true, slug: true } }),
    db.unit.findMany({ select: { code: true, name: true } }),
  ]);
  const refs: Refs = {
    categories,
    subcategories,
    types,
    unitCodes: units.map((u) => u.code),
    unitNames: units,
  };
  refsCache = { at: Date.now(), refs };
  return refs;
}

/** The downloadable .xlsx template with category / subcategory / product type drop-downs. */
export async function productTemplateFile(ctx: Ctx) {
  guard(ctx);
  return buildProductTemplate(await loadRefs());
}

// ───────────────────────── job lifecycle ─────────────────────────

const fieldKeys = FIELDS.map((f) => f.key) as [FieldKey, ...FieldKey[]];
const createSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  headers: z.array(z.string().max(300)).min(1).max(MAX_CELLS),
  columnMap: z.partialRecord(
    z.enum(fieldKeys),
    z
      .number()
      .int()
      .min(0)
      .max(MAX_CELLS - 1),
  ),
  mode: z.enum(["CREATE", "UPSERT", "UPDATE"]).default("CREATE"),
  totalRows: z.number().int().min(1, "The file has no data rows").max(BULK_MAX_ROWS),
});

async function ownJob(ctx: Ctx, id: string) {
  const job = await db.importJob.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!job) throw new AppError("Import not found", "NOT_FOUND");
  return job;
}

/** Step 1: register the file and its column mapping. Rows follow via stageImportRows. */
export async function createImportJob(ctx: Ctx, raw: unknown) {
  guard(ctx);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(parsed.error.issues[0]?.message ?? "Invalid import request", "VALIDATION");
  const d = parsed.data;
  const map = d.columnMap as ColumnMap;
  for (const i of Object.values(map))
    if (i !== undefined && i >= d.headers.length)
      throw new AppError("Column mapping points past the end of the header row", "VALIDATION");
  const missing = missingRequired(map, REQUIRED_FIELDS, d.mode === "UPDATE");
  if (d.mode === "CREATE" || d.mode === "UPSERT") {
    if (missing.length)
      throw new AppError(
        `Map these required columns first: ${missing.map((k) => FIELDS.find((f) => f.key === k)!.label).join(", ")}`,
        "VALIDATION",
      );
  }
  if (d.mode !== "CREATE" && map.sku === undefined)
    throw new AppError(
      "Updating existing products needs a SKU column to match rows to your products.",
      "VALIDATION",
    );
  if (d.mode === "UPDATE" && Object.keys(map).filter((k) => k !== "sku").length === 0)
    throw new AppError("Map at least one column to update besides SKU.", "VALIDATION");
  const rl = hit(`bulk-create:${ctx.userId}`, 20, 60 * 60_000);
  if (!rl.ok)
    throw new AppError(`Slow down: try again in ${rl.retryAfterSec} seconds.`, "RATE_LIMIT");
  const open = await db.importJob.count({
    where: {
      orgId: ctx.orgId,
      status: { in: ["UPLOADING", "VALIDATING", "PROCESSING", "ROLLING_BACK"] },
      updatedAt: { gt: new Date(Date.now() - 3 * 3600_000) },
    },
  });
  if (open >= 3)
    throw new AppError(
      "You already have imports in progress. Finish or cancel them before starting another.",
      "CONFLICT",
    );
  const job = await db.importJob.create({
    data: {
      orgId: ctx.orgId,
      userId: ctx.userId,
      filename: d.filename,
      mode: d.mode,
      headers: d.headers,
      columnMap: map as Prisma.InputJsonObject,
      totalRows: d.totalRows,
    },
    select: { id: true },
  });
  return job.id;
}

const stageSchema = z.object({
  rows: z
    .array(
      z.object({
        n: z
          .number()
          .int()
          .min(1)
          .max(BULK_MAX_ROWS + 10_000),
        c: z.array(z.string()).max(MAX_CELLS),
      }),
    )
    .min(1)
    .max(STAGE_CHUNK_MAX),
});

/** Step 2 (repeated): store a chunk of rows. Safe to resend: existing row numbers are ignored. */
export async function stageImportRows(ctx: Ctx, jobId: string, raw: unknown) {
  guard(ctx);
  const job = await ownJob(ctx, jobId);
  if (job.status !== "UPLOADING")
    throw new AppError("This import is no longer accepting rows.", "CONFLICT");
  const parsed = stageSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Invalid rows chunk", "VALIDATION");
  const cells = (c: string[]) =>
    c.map((v) => (v.length > MAX_CELL_CHARS ? v.slice(0, MAX_CELL_CHARS) : v));
  const res = await db.importRow.createMany({
    data: parsed.data.rows.map((r) => ({
      jobId,
      rowNumber: r.n,
      raw: cells(r.c),
    })),
    skipDuplicates: true,
  });
  const staged = await db.importRow.count({ where: { jobId } });
  if (staged > job.totalRows)
    throw new AppError("More rows were uploaded than the file declared.", "VALIDATION");
  return { staged, added: res.count };
}

/** Step 3: all rows are in. Moves the job to validation. */
export async function finishImportUpload(ctx: Ctx, jobId: string) {
  guard(ctx);
  const job = await ownJob(ctx, jobId);
  if (job.status !== "UPLOADING") return progress(jobId);
  const staged = await db.importRow.count({ where: { jobId } });
  if (staged !== job.totalRows)
    throw new AppError(
      `Upload incomplete: ${staged.toLocaleString("en")} of ${job.totalRows.toLocaleString("en")} rows arrived. Try again.`,
      "CONFLICT",
    );
  await db.importJob.update({ where: { id: jobId }, data: { status: "VALIDATING" } });
  return progress(jobId);
}

// ───────────────────────── progress ─────────────────────────

export type Progress = {
  id: string;
  status: string;
  mode: string;
  filename: string;
  totalRows: number;
  counts: Record<string, number>;
  message: string | null;
  finishedAt: Date | null;
};

async function progress(jobId: string): Promise<Progress> {
  const [job, groups] = await Promise.all([
    db.importJob.findUniqueOrThrow({ where: { id: jobId } }),
    db.importRow.groupBy({ by: ["status"], where: { jobId }, _count: { _all: true } }),
  ]);
  const counts: Record<string, number> = {};
  for (const g of groups) counts[g.status] = g._count._all;
  return {
    id: job.id,
    status: job.status,
    mode: job.mode,
    filename: job.filename,
    totalRows: job.totalRows,
    counts,
    message: job.message,
    finishedAt: job.finishedAt,
  };
}

export async function getImportProgress(ctx: Ctx, jobId: string) {
  guard(ctx);
  await ownJob(ctx, jobId);
  return progress(jobId);
}

/** Detail view: progress plus the first problem rows and a sample of good rows. */
export async function getImportDetail(ctx: Ctx, jobId: string) {
  guard(ctx);
  const job = await ownJob(ctx, jobId);
  const [p, problems, sample] = await Promise.all([
    progress(jobId),
    db.importRow.findMany({
      where: { jobId, status: { in: ["INVALID", "FAILED"] } },
      orderBy: { rowNumber: "asc" },
      take: 100,
      select: { rowNumber: true, status: true, raw: true, errors: true, message: true },
    }),
    db.importRow.findMany({
      where: { jobId, status: { in: ["VALID", "CREATED", "UPDATED"] } },
      orderBy: { rowNumber: "asc" },
      take: 12,
      select: { rowNumber: true, action: true, values: true, warnings: true, status: true },
    }),
  ]);
  const warned = await db.importRow.count({
    where: { jobId, status: "VALID", NOT: { warnings: { equals: Prisma.DbNull } } },
  });
  return {
    progress: p,
    headers: job.headers as string[],
    columnMap: job.columnMap as ColumnMap,
    problems,
    sample,
    warned,
    canRollback:
      (job.status === "COMPLETED" || job.status === "COMPLETED_WITH_ERRORS") &&
      Date.now() - (job.finishedAt ?? job.updatedAt).getTime() < ROLLBACK_WINDOW_DAYS * 864e5,
  };
}

export async function listImportJobs(ctx: Ctx, limit = 20) {
  guard(ctx);
  return db.importJob.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      filename: true,
      mode: true,
      status: true,
      totalRows: true,
      createdAt: true,
      finishedAt: true,
    },
  });
}

// ───────────────────────── leasing ─────────────────────────

async function lease(jobId: string): Promise<boolean> {
  const r = await db.importJob.updateMany({
    where: {
      id: jobId,
      OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - LEASE_MS) } }],
    },
    data: { lockedAt: new Date() },
  });
  return r.count === 1;
}
const unlock = (jobId: string) =>
  db.importJob.updateMany({ where: { id: jobId }, data: { lockedAt: null } });

// ───────────────────────── validation ─────────────────────────

type ValidatedRow = {
  id: string;
  status: "VALID" | "INVALID";
  action: string | null;
  values: RowValues | null;
  errors: RowIssue[] | null;
  warnings: RowIssue[] | null;
  dupKey: string | null;
  productId: string | null;
};

const j = (v: unknown) => (v == null || (Array.isArray(v) && !v.length) ? null : JSON.stringify(v));

async function saveValidated(rows: ValidatedRow[]) {
  if (!rows.length) return;
  // One statement for the whole batch instead of one round trip per row.
  await db.$executeRaw`
    UPDATE "ImportRow" AS r SET
      "status" = v.status::"ImportRowStatus",
      "action" = v.action,
      "values" = v.vals::jsonb,
      "errors" = v.errs::jsonb,
      "warnings" = v.warns::jsonb,
      "dupKey" = v.dup,
      "productId" = v.pid
    FROM (
      SELECT * FROM unnest(
        ${rows.map((r) => r.id)}::text[],
        ${rows.map((r) => r.status)}::text[],
        ${rows.map((r) => r.action)}::text[],
        ${rows.map((r) => j(r.values))}::text[],
        ${rows.map((r) => j(r.errors))}::text[],
        ${rows.map((r) => j(r.warnings))}::text[],
        ${rows.map((r) => r.dupKey)}::text[],
        ${rows.map((r) => r.productId)}::text[]
      ) AS t(id, status, action, vals, errs, warns, dup, pid)
    ) AS v
    WHERE r."id" = v.id`;
}

async function validateBatch(
  job: { id: string; orgId: string; mode: "CREATE" | "UPSERT" | "UPDATE"; columnMap: unknown },
  refs: Refs,
  limit: number,
): Promise<number> {
  const map = job.columnMap as ColumnMap;
  const rows = await db.importRow.findMany({
    where: { jobId: job.id, status: "PENDING" },
    orderBy: { rowNumber: "asc" },
    take: limit,
    select: { id: true, raw: true },
  });
  if (!rows.length) return 0;
  const checked = rows.map((r) => ({
    id: r.id,
    res: validateRow((r.raw as string[] | null) ?? [], map, refs),
  }));

  // Match existing products by SKU (exact, as the database unique key is), and sku-less rows by name.
  const skus = [...new Set(checked.map((c) => c.res.values.sku).filter((s): s is string => !!s))];
  const bySku = new Map(
    (skus.length
      ? await db.product.findMany({
          where: { orgId: job.orgId, sku: { in: skus } },
          select: { id: true, sku: true },
        })
      : []
    ).map((p) => [p.sku!, p.id]),
  );
  const names = [
    ...new Set(
      checked.filter((c) => !c.res.values.sku && c.res.values.name).map((c) => c.res.values.name!),
    ),
  ];
  const byName = new Map<string, string>();
  if (names.length && job.mode !== "UPDATE") {
    const found = await db.product.findMany({
      where: { orgId: job.orgId, name: { in: names } },
      select: { id: true, name: true, unitCode: true, brand: { select: { name: true } } },
    });
    for (const p of found)
      byName.set(dedupeKey({ name: p.name, brandName: p.brand?.name, unitCode: p.unitCode }), p.id);
  }

  const out: ValidatedRow[] = checked.map(({ id, res }) => {
    const v = res.values;
    const errors: RowIssue[] = [...res.errors];
    let action: string | null = null;
    let productId: string | null = null;
    const existing = v.sku ? bySku.get(v.sku) : undefined;
    if (!errors.length) {
      if (job.mode === "UPDATE") {
        if (!v.sku)
          errors.push({
            field: "sku",
            message: "SKU is missing",
            fix: "Fill in the SKU of the product to update",
          });
        else if (!existing)
          errors.push({
            field: "sku",
            message: `No product with SKU “${v.sku}” in your catalogue`,
            fix: "Check the SKU, or import as new products",
          });
        else {
          action = "UPDATE";
          productId = existing;
        }
      } else if (existing) {
        if (job.mode === "UPSERT") {
          action = "UPDATE";
          productId = existing;
        } else
          errors.push({
            field: "sku",
            message: `SKU “${v.sku}” already exists in your catalogue`,
            fix: "Remove the row, or upload with “Create or update”",
          });
      } else {
        const same = !v.sku && byName.get(dedupeKey(v));
        if (same)
          errors.push({
            field: "name",
            message: "A product with the same name, brand and unit already exists",
            fix: "Add a SKU to update it, or change the name",
          });
        else {
          errors.push(...missingForCreate(v));
          if (!errors.length) {
            action = "CREATE";
            productId = randomUUID();
          }
        }
      }
    }
    // A row that only changes nothing useful is worth flagging rather than counting as success.
    if (
      !errors.length &&
      action === "UPDATE" &&
      Object.keys(v).filter((k) => k !== "sku").length === 0
    )
      errors.push({
        field: "sku",
        message: "Nothing to update on this row",
        fix: "Fill in at least one column to change",
      });
    const bad = errors.length > 0;
    return {
      id,
      status: bad ? "INVALID" : "VALID",
      action,
      values: bad ? null : v,
      errors: bad ? errors : null,
      warnings: res.warnings,
      dupKey: bad ? null : dedupeKey(v),
      productId,
    };
  });
  await saveValidated(out);
  return rows.length;
}

/** Marks later copies of the same product inside one file as invalid (first occurrence wins). */
async function markFileDuplicates(jobId: string) {
  await db.$executeRaw`
    UPDATE "ImportRow" AS r SET
      "status" = 'INVALID',
      "action" = NULL,
      "productId" = NULL,
      "errors" = jsonb_build_array(jsonb_build_object(
        'field', CASE WHEN r."dupKey" LIKE 'sku:%' THEN 'sku' ELSE 'name' END,
        'message', 'Duplicate of row ' || d.first_row || ' in this file',
        'fix', 'Remove one of the duplicate rows'))
    FROM (
      SELECT "id",
             MIN("rowNumber") OVER (PARTITION BY "dupKey") AS first_row,
             ROW_NUMBER() OVER (PARTITION BY "dupKey" ORDER BY "rowNumber") AS rn
      FROM "ImportRow"
      WHERE "jobId" = ${jobId} AND "status" = 'VALID' AND "dupKey" IS NOT NULL
    ) AS d
    WHERE r."id" = d."id" AND d.rn > 1`;
}

/** Validates one time-boxed slice. Call repeatedly until `done`. */
export async function stepValidate(ctx: Ctx, jobId: string, budgetMs = 8000) {
  guard(ctx);
  const job = await ownJob(ctx, jobId);
  return advanceValidation(job, budgetMs);
}

async function advanceValidation(
  job: {
    id: string;
    orgId: string;
    status: string;
    mode: "CREATE" | "UPSERT" | "UPDATE";
    columnMap: unknown;
  },
  budgetMs: number,
) {
  if (job.status !== "VALIDATING")
    return { ...(await progress(job.id)), done: job.status !== "UPLOADING", busy: false };
  if (!(await lease(job.id))) return { ...(await progress(job.id)), done: false, busy: true };
  const t0 = Date.now();
  try {
    const refs = await loadRefs();
    let more = true;
    while (more && Date.now() - t0 < budgetMs) more = (await validateBatch(job, refs, 500)) > 0;
    const pending = await db.importRow.count({ where: { jobId: job.id, status: "PENDING" } });
    if (pending === 0) {
      await markFileDuplicates(job.id);
      const valid = await db.importRow.count({ where: { jobId: job.id, status: "VALID" } });
      await db.importJob.update({
        where: { id: job.id },
        data: {
          status: "READY",
          message:
            valid === 0 ? "No valid rows found. Download the error report to fix the file." : null,
        },
      });
    }
    return { ...(await progress(job.id)), done: pending === 0, busy: false };
  } finally {
    await unlock(job.id);
  }
}

// ───────────────────────── applying rows ─────────────────────────

/** Fields an update may change, and how each maps onto the Product row. */
type Env = {
  orgId: string;
  actorId: string;
  city: string | null;
  brandIds: Map<string, { id: string; manufacturerId: string | null }>;
  manufacturerIds: Map<string, string>;
  slugs: Set<string>;
};

type StagedRow = {
  id: string;
  rowNumber: number;
  action: string | null;
  values: unknown;
  productId: string | null;
};

const nn = (s?: string) => (s ? s : null);

function specsJson(text?: string): Prisma.InputJsonObject | undefined {
  if (!text) return undefined;
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return Object.keys(out).length ? out : undefined;
}

async function brandFor(name: string, env: Env) {
  const key = name.toLowerCase();
  const hit = env.brandIds.get(key);
  if (hit) return hit;
  const slug = slugify(name);
  if (!slug) return null;
  const b = await db.brand.upsert({
    where: { slug },
    update: {},
    create: { slug, name },
    select: { id: true, manufacturerId: true },
  });
  env.brandIds.set(key, b);
  return b;
}
async function manufacturerFor(name: string, env: Env) {
  const key = name.toLowerCase();
  const hit = env.manufacturerIds.get(key);
  if (hit) return hit;
  const slug = slugify(name);
  if (!slug) return null;
  const m = await db.manufacturer.upsert({
    where: { slug },
    update: {},
    create: { slug, name },
    select: { id: true },
  });
  env.manufacturerIds.set(key, m.id);
  return m.id;
}

function claimSlug(name: string, env: Env) {
  const root = slugify(name) || "product";
  let slug = root;
  for (let i = 2; env.slugs.has(slug); i++) slug = `${root}-${i}`;
  env.slugs.add(slug);
  return slug;
}

async function prepareEnv(job: { orgId: string; userId: string }, rows: StagedRow[]): Promise<Env> {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: job.orgId },
    select: { city: true },
  });
  const roots = new Set<string>();
  for (const r of rows)
    if (r.action === "CREATE") roots.add(slugify((r.values as RowValues).name ?? "") || "product");
  const existing = roots.size
    ? await db.product.findMany({
        where: {
          orgId: job.orgId,
          OR: [...roots].map((root) => ({ slug: { startsWith: root } })),
        },
        select: { slug: true },
      })
    : [];
  return {
    orgId: job.orgId,
    actorId: job.userId,
    city: org.city,
    brandIds: new Map(),
    manufacturerIds: new Map(),
    slugs: new Set(existing.map((e) => e.slug)),
  };
}

const ATTRS = [
  "material",
  "grade",
  "size",
  "dimensions",
  "color",
  "finish",
  "application",
  "countryOfOrigin",
] as const;
type UpdateData = Prisma.ProductUncheckedUpdateInput;

async function updateFields(
  v: RowValues,
  cur: { categoryId: string; subcategoryId: string | null },
  env: Env,
) {
  const d: UpdateData = {};
  if (v.name !== undefined) d.name = v.name;
  if (v.description !== undefined) d.description = v.description;
  if (v.categoryId !== undefined) {
    d.categoryId = v.categoryId;
    // Moving to another category invalidates the old subcategory and type unless new ones are given.
    if (v.categoryId !== cur.categoryId && v.subcategoryId === undefined) {
      d.subcategoryId = null;
      d.productTypeId = null;
    }
  }
  if (v.subcategoryId !== undefined) {
    d.subcategoryId = v.subcategoryId;
    if (v.productTypeId === undefined && v.subcategoryId !== cur.subcategoryId)
      d.productTypeId = null;
  }
  if (v.productTypeId !== undefined) d.productTypeId = v.productTypeId;
  if (v.brandName !== undefined) {
    const b = await brandFor(v.brandName, env);
    if (b) {
      d.brandId = b.id;
      if (v.manufacturerName === undefined && b.manufacturerId) d.manufacturerId = b.manufacturerId;
    }
  }
  if (v.manufacturerName !== undefined) {
    const m = await manufacturerFor(v.manufacturerName, env);
    if (m) d.manufacturerId = m;
  }
  if (v.unitCode !== undefined) d.unitCode = v.unitCode;
  if (v.price !== undefined) d.price = v.price;
  if (v.wholesalePrice !== undefined) d.wholesalePrice = v.wholesalePrice;
  if (v.contractorPrice !== undefined) d.contractorPrice = v.contractorPrice;
  if (v.minOrderQty !== undefined) d.minOrderQty = v.minOrderQty;
  if (v.stockStatus !== undefined) d.stockStatus = v.stockStatus;
  if (v.packageSize !== undefined) d.packageSize = v.packageSize;
  if (v.vatRatePercent !== undefined) d.vatRatePercent = v.vatRatePercent;
  if (v.city !== undefined) d.city = v.city;
  for (const a of ATTRS) if (v[a] !== undefined) d[a] = v[a];
  const specs = specsJson(v.specifications);
  if (specs) d.specifications = specs;
  if (v.deliveryAvailable !== undefined) d.deliveryAvailable = v.deliveryAvailable;
  if (v.isActive !== undefined) d.isActive = v.isActive;
  return d;
}

const jsonSafe = (o: Record<string, unknown>) =>
  JSON.parse(
    JSON.stringify(o, (_k, val) => (val instanceof Prisma.Decimal ? val.toString() : val)),
  ) as Prisma.InputJsonObject;

/**
 * Applies rows inside one transaction. Throws if anything in the batch cannot be written, and the
 * caller then retries the rows one at a time so a single bad row cannot sink its neighbours.
 */
async function applyBatch(tx: Prisma.TransactionClient, rows: StagedRow[], env: Env) {
  const creates = rows.filter((r) => r.action === "CREATE");
  const updates = rows.filter((r) => r.action === "UPDATE");

  if (creates.length) {
    const data: Prisma.ProductCreateManyInput[] = [];
    for (const r of creates) {
      const v = r.values as RowValues;
      const brand = v.brandName ? await brandFor(v.brandName, env) : null;
      const manufacturerId = v.manufacturerName
        ? await manufacturerFor(v.manufacturerName, env)
        : (brand?.manufacturerId ?? null);
      data.push({
        id: r.productId!,
        orgId: env.orgId,
        categoryId: v.categoryId!,
        subcategoryId: v.subcategoryId ?? null,
        productTypeId: v.productTypeId ?? null,
        brandId: brand?.id ?? null,
        manufacturerId,
        unitCode: v.unitCode!,
        sku: nn(v.sku),
        name: v.name!,
        slug: claimSlug(v.name!, env),
        description: nn(v.description),
        specifications: specsJson(v.specifications),
        packageSize: nn(v.packageSize),
        material: nn(v.material),
        grade: nn(v.grade),
        size: nn(v.size),
        dimensions: nn(v.dimensions),
        color: nn(v.color),
        finish: nn(v.finish),
        application: nn(v.application),
        countryOfOrigin: nn(v.countryOfOrigin),
        minOrderQty: v.minOrderQty ?? 1,
        stockStatus: v.stockStatus ?? "IN_STOCK",
        price: v.price!,
        wholesalePrice: v.wholesalePrice ?? null,
        contractorPrice: v.contractorPrice ?? null,
        vatRatePercent: v.vatRatePercent ?? 5,
        city: v.city ?? env.city,
        deliveryAvailable: v.deliveryAvailable ?? true,
        isActive: v.isActive ?? true,
      });
    }
    await tx.product.createMany({ data });
    await tx.priceHistory.createMany({
      data: creates.map((r) => ({
        productId: r.productId!,
        price: (r.values as RowValues).price!,
        tier: "RETAIL" as const,
        changedBy: env.actorId,
      })),
    });
    const imgs = creates.filter((r) => (r.values as RowValues).imageUrl);
    if (imgs.length)
      await tx.productImage.createMany({
        data: imgs.map((r) => ({
          productId: r.productId!,
          url: (r.values as RowValues).imageUrl!,
          alt: (r.values as RowValues).name!,
        })),
      });
  }

  const before = new Map<string, Prisma.InputJsonObject>();
  if (updates.length) {
    const cur = await tx.product.findMany({
      where: { orgId: env.orgId, id: { in: updates.map((u) => u.productId!) } },
    });
    const byId = new Map(cur.map((p) => [p.id, p]));
    for (const r of updates) {
      const p = byId.get(r.productId!);
      if (!p) throw new AppError(`Row ${r.rowNumber}: the product no longer exists`, "NOT_FOUND");
      const v = r.values as RowValues;
      const d = await updateFields(v, p, env);
      const snap: Record<string, unknown> = {};
      for (const k of Object.keys(d)) snap[k] = (p as Record<string, unknown>)[k];
      before.set(r.id, jsonSafe(snap));
      if (Object.keys(d).length) await tx.product.update({ where: { id: p.id }, data: d });
      if (v.price !== undefined && !p.price.equals(v.price))
        await tx.priceHistory.create({
          data: { productId: p.id, price: v.price, tier: "RETAIL", changedBy: env.actorId },
        });
      if (v.imageUrl) {
        const has = await tx.productImage.count({ where: { productId: p.id } });
        if (!has)
          await tx.productImage.create({ data: { productId: p.id, url: v.imageUrl, alt: p.name } });
      }
    }
  }

  const now = new Date();
  if (creates.length)
    await tx.importRow.updateMany({
      where: { id: { in: creates.map((r) => r.id) } },
      data: { status: "CREATED", appliedAt: now, raw: Prisma.DbNull },
    });
  for (const r of updates)
    await tx.importRow.update({
      where: { id: r.id },
      data: { status: "UPDATED", appliedAt: now, raw: Prisma.DbNull, before: before.get(r.id) },
    });
}

function shortError(e: unknown): string {
  if (e instanceof AppError) return e.message.slice(0, 300);
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return "Conflicts with an existing product (duplicate SKU or name)";
    if (e.code === "P2003") return "Refers to a category, unit or brand that no longer exists";
    return `Database rejected the row (${e.code})`;
  }
  return "Could not be saved";
}

async function applyChunk(job: { id: string; orgId: string; userId: string }, rows: StagedRow[]) {
  const env = await prepareEnv(job, rows);
  try {
    await db.$transaction((tx) => applyBatch(tx, rows, env), { timeout: 30_000, maxWait: 10_000 });
    return;
  } catch {
    // Fall through: retry row by row so one bad row is reported instead of blocking the chunk.
  }
  for (const r of rows) {
    const env1 = await prepareEnv(job, [r]);
    try {
      await db.$transaction((tx) => applyBatch(tx, [r], env1), { timeout: 15_000 });
    } catch (e) {
      await db.importRow.update({
        where: { id: r.id },
        data: { status: "FAILED", message: shortError(e) },
      });
    }
  }
}

// ───────────────────────── run ─────────────────────────

/** Step 4: user confirmed the preview. Checks plan limits, then starts applying. */
export async function startImport(ctx: Ctx, jobId: string, raw: unknown) {
  guard(ctx);
  const opts = z.object({ onErrors: z.enum(["skip", "block"]).default("skip") }).parse(raw ?? {});
  const job = await ownJob(ctx, jobId);
  if (job.status !== "READY") throw new AppError("This import is not ready to start.", "CONFLICT");
  const [valid, invalid] = await Promise.all([
    db.importRow.count({ where: { jobId, status: "VALID" } }),
    db.importRow.count({ where: { jobId, status: "INVALID" } }),
  ]);
  if (valid === 0) throw new AppError("There are no valid rows to import.", "VALIDATION");
  if (opts.onErrors === "block" && invalid > 0)
    throw new AppError(
      `${invalid.toLocaleString("en")} rows have errors. Fix the file, or choose to import the valid rows only.`,
      "VALIDATION",
    );
  const lim = await getEffectiveLimits(ctx.orgId);
  if (lim.productLimit !== null) {
    const [active, newActive, reactivated] = await Promise.all([
      db.product.count({ where: { orgId: ctx.orgId, isActive: true } }),
      db.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*)::bigint AS n FROM "ImportRow"
        WHERE "jobId" = ${jobId} AND "status" = 'VALID' AND "action" = 'CREATE'
          AND "values"->>'isActive' IS DISTINCT FROM 'false'`,
      db.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*)::bigint AS n FROM "ImportRow" r JOIN "Product" p ON p."id" = r."productId"
        WHERE r."jobId" = ${jobId} AND r."status" = 'VALID' AND r."action" = 'UPDATE'
          AND r."values"->>'isActive' = 'true' AND p."isActive" = false`,
    ]);
    const need = Number(newActive[0]?.n ?? 0) + Number(reactivated[0]?.n ?? 0);
    if (active + need > lim.productLimit)
      throw new AppError(
        `Your ${lim.planName} plan allows ${lim.productLimit} active products. You have ${active} and this import would add ${need}. Upgrade, or import fewer rows.`,
        "FORBIDDEN",
      );
  }
  await db.importJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", options: opts, startedAt: new Date(), message: null },
  });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "product.bulk_import_started",
    entity: "ImportJob",
    entityId: jobId,
    meta: { valid, invalid, mode: job.mode },
  });
  return progress(jobId);
}

/** Applies one time-boxed slice of VALID rows. Call repeatedly until `done`. */
export async function stepImport(ctx: Ctx, jobId: string, budgetMs = 8000) {
  guard(ctx);
  const job = await ownJob(ctx, jobId);
  return advanceProcessing(job, budgetMs);
}

type JobLite = { id: string; orgId: string; userId: string; status: string; filename: string };

async function advanceProcessing(job: JobLite, budgetMs: number) {
  if (job.status !== "PROCESSING") return { ...(await progress(job.id)), done: true, busy: false };
  if (!(await lease(job.id))) return { ...(await progress(job.id)), done: false, busy: true };
  const t0 = Date.now();
  try {
    let left = 1;
    while (left > 0 && Date.now() - t0 < budgetMs) {
      const rows = await db.importRow.findMany({
        where: { jobId: job.id, status: "VALID" },
        orderBy: { rowNumber: "asc" },
        take: 200,
        select: { id: true, rowNumber: true, action: true, values: true, productId: true },
      });
      left = rows.length;
      if (!rows.length) break;
      await applyChunk(job, rows);
    }
    const remaining = await db.importRow.count({ where: { jobId: job.id, status: "VALID" } });
    if (remaining === 0) await finalize(job);
    return { ...(await progress(job.id)), done: remaining === 0, busy: false };
  } finally {
    await unlock(job.id);
  }
}

async function finalize(job: JobLite) {
  const p = await progress(job.id);
  const c = p.counts;
  const bad = (c.INVALID ?? 0) + (c.FAILED ?? 0);
  const created = c.CREATED ?? 0;
  const updated = c.UPDATED ?? 0;
  const flip = await db.importJob.updateMany({
    where: { id: job.id, status: "PROCESSING" },
    data: {
      status: bad ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      finishedAt: new Date(),
      message: `${created} created, ${updated} updated${bad ? `, ${bad} not imported` : ""}.`,
    },
  });
  if (flip.count !== 1) return;
  await audit({
    orgId: job.orgId,
    actorId: job.userId,
    action: "product.bulk_imported",
    entity: "ImportJob",
    entityId: job.id,
    meta: { created, updated, failed: bad },
  });
  await notifyOrg({
    orgId: job.orgId,
    type: "import.done",
    title: `Import finished: ${job.filename}`,
    body: `${created} created, ${updated} updated${bad ? `, ${bad} rows need attention` : ""}.`,
    href: `/dashboard/products/import/${job.id}`,
  }).catch(() => {});
}

// ───────────────────────── cancel & rollback ─────────────────────────

export async function cancelImport(ctx: Ctx, jobId: string) {
  guard(ctx);
  const job = await ownJob(ctx, jobId);
  if (!["UPLOADING", "VALIDATING", "READY"].includes(job.status))
    throw new AppError("This import can no longer be cancelled.", "CONFLICT");
  await db.$transaction([
    db.importRow.deleteMany({ where: { jobId } }),
    db.importJob.update({
      where: { id: jobId },
      data: { status: "CANCELLED", finishedAt: new Date() },
    }),
  ]);
  return progress(jobId);
}

export async function startRollback(ctx: Ctx, jobId: string) {
  guard(ctx);
  const job = await ownJob(ctx, jobId);
  if (job.status !== "COMPLETED" && job.status !== "COMPLETED_WITH_ERRORS")
    throw new AppError("Only a finished import can be rolled back.", "CONFLICT");
  if (Date.now() - (job.finishedAt ?? job.updatedAt).getTime() > ROLLBACK_WINDOW_DAYS * 864e5)
    throw new AppError(`Imports can be rolled back for ${ROLLBACK_WINDOW_DAYS} days.`, "CONFLICT");
  await db.importJob.update({
    where: { id: jobId },
    data: { status: "ROLLING_BACK", message: null },
  });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "product.bulk_rollback_started",
    entity: "ImportJob",
    entityId: jobId,
  });
  return progress(jobId);
}

export async function stepRollback(ctx: Ctx, jobId: string, budgetMs = 8000) {
  guard(ctx);
  const job = await ownJob(ctx, jobId);
  return advanceRollback(job, budgetMs);
}

const TOUCH_GRACE_MS = 2000;

async function rollbackChunk(job: JobLite) {
  const rows = await db.importRow.findMany({
    where: { jobId: job.id, status: { in: ["CREATED", "UPDATED"] } },
    orderBy: { rowNumber: "asc" },
    take: 100,
    select: { id: true, status: true, productId: true, before: true, appliedAt: true },
  });
  if (!rows.length) return 0;
  const products = await db.product.findMany({
    where: { orgId: job.orgId, id: { in: rows.map((r) => r.productId!).filter(Boolean) } },
    select: {
      id: true,
      price: true,
      updatedAt: true,
      _count: { select: { orderItems: true, rfqItems: true, reviews: true, inventory: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const r of rows) {
    const p = r.productId ? byId.get(r.productId) : undefined;
    const touched =
      !!p && !!r.appliedAt && p.updatedAt.getTime() > r.appliedAt.getTime() + TOUCH_GRACE_MS;
    let status: "ROLLED_BACK" | "SKIPPED" = "ROLLED_BACK";
    let message: string | null = null;
    try {
      if (!p) {
        message = "The product no longer exists";
        status = "SKIPPED";
      } else if (r.status === "CREATED") {
        const used =
          p._count.orderItems + p._count.rfqItems + p._count.reviews + p._count.inventory > 0;
        if (used || touched) {
          await db.product.update({ where: { id: p.id }, data: { isActive: false } });
          message = used
            ? "Kept as an inactive product because it is used in orders, RFQs or reviews"
            : "Kept as an inactive product because you edited it after the import";
        } else await db.product.delete({ where: { id: p.id } });
      } else if (touched) {
        message = "Not restored: the product was edited after the import";
        status = "SKIPPED";
      } else {
        const b = (r.before ?? {}) as Record<string, unknown>;
        const data: Record<string, unknown> = { ...b };
        if ("specifications" in data && data.specifications === null)
          data.specifications = Prisma.DbNull;
        await db.$transaction(async (tx) => {
          await tx.product.update({ where: { id: p.id }, data: data as UpdateData });
          if (b.price !== undefined && !p.price.equals(b.price as string))
            await tx.priceHistory.create({
              data: {
                productId: p.id,
                price: b.price as string,
                tier: "RETAIL",
                changedBy: job.userId,
              },
            });
        });
      }
    } catch (e) {
      status = "SKIPPED";
      message = shortError(e);
    }
    await db.importRow.update({ where: { id: r.id }, data: { status, message } });
  }
  return rows.length;
}

async function advanceRollback(job: JobLite, budgetMs: number) {
  if (job.status !== "ROLLING_BACK")
    return { ...(await progress(job.id)), done: true, busy: false };
  if (!(await lease(job.id))) return { ...(await progress(job.id)), done: false, busy: true };
  const t0 = Date.now();
  try {
    let n = 1;
    while (n > 0 && Date.now() - t0 < budgetMs) n = await rollbackChunk(job);
    const left = await db.importRow.count({
      where: { jobId: job.id, status: { in: ["CREATED", "UPDATED"] } },
    });
    if (left === 0) {
      const skipped = await db.importRow.count({ where: { jobId: job.id, status: "SKIPPED" } });
      await db.importJob.update({
        where: { id: job.id },
        data: {
          status: "ROLLED_BACK",
          finishedAt: new Date(),
          message: skipped
            ? `Rolled back. ${skipped} rows could not be fully restored (see notes).`
            : "Rolled back completely.",
        },
      });
      await audit({
        orgId: job.orgId,
        actorId: job.userId,
        action: "product.bulk_rolled_back",
        entity: "ImportJob",
        entityId: job.id,
        meta: { skipped },
      });
    }
    return { ...(await progress(job.id)), done: left === 0, busy: false };
  } finally {
    await unlock(job.id);
  }
}

// ───────────────────────── reports ─────────────────────────

/** CSV of every row that was rejected or failed, with the original cells and how to fix them. */
export async function importErrorReport(ctx: Ctx, jobId: string) {
  guard(ctx);
  const job = await ownJob(ctx, jobId);
  const headers = (job.headers as string[]).map((h, i) => h || `Column ${i + 1}`);
  const all: ReportRow[] = [];
  let cursor = 0;
  for (;;) {
    const rows = await db.importRow.findMany({
      where: { jobId, status: { in: ["INVALID", "FAILED", "SKIPPED"] }, rowNumber: { gt: cursor } },
      orderBy: { rowNumber: "asc" },
      take: 5000,
      select: { rowNumber: true, raw: true, errors: true, message: true, status: true },
    });
    if (!rows.length) break;
    for (const r of rows) {
      const errs = (r.errors as RowIssue[] | null) ?? [];
      all.push({
        rowNumber: r.rowNumber,
        cells: (r.raw as string[] | null) ?? [],
        errors: errs.length
          ? errs
          : r.message
            ? [
                {
                  field: "name" as FieldKey,
                  message: r.message,
                  fix: r.status === "FAILED" ? "Try uploading this row again" : "",
                },
              ]
            : [],
      });
    }
    cursor = rows[rows.length - 1]!.rowNumber;
  }
  return {
    filename: `${job.filename.replace(/\.[^.]+$/, "")}-errors.csv`,
    csv: buildErrorReport(headers, all),
  };
}

// ───────────────────────── background helpers ─────────────────────────

/** Cron: advance jobs whose browser went away, and purge old staging data. */
export async function maintainImports(budgetMs = 40_000) {
  const t0 = Date.now();
  const stale = new Date(Date.now() - 90_000);
  const jobs = await db.importJob.findMany({
    where: {
      status: { in: ["VALIDATING", "PROCESSING", "ROLLING_BACK"] },
      updatedAt: { lt: stale },
    },
    orderBy: { updatedAt: "asc" },
    take: 5,
  });
  let advanced = 0;
  for (const job of jobs) {
    const left = budgetMs - (Date.now() - t0);
    if (left < 5000) break;
    const per = Math.min(left - 2000, 20_000);
    if (job.status === "VALIDATING") await advanceValidation(job, per);
    else if (job.status === "PROCESSING") await advanceProcessing(job, per);
    else await advanceRollback(job, per);
    advanced++;
  }
  const purge = await db.importJob.deleteMany({
    where: {
      OR: [
        { status: "UPLOADING", createdAt: { lt: new Date(Date.now() - 2 * 864e5) } },
        { createdAt: { lt: new Date(Date.now() - 45 * 864e5) } },
      ],
    },
  });
  return { advanced, purged: purge.count };
}
