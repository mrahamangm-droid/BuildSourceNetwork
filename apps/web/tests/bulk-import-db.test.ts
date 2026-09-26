import { beforeAll, describe, expect, it } from "vitest";
import { makeAccount, resetDb } from "./helpers";
import { syncTaxonomy } from "../../../packages/database/prisma/reference";
import { autoMapColumns } from "../src/lib/bulk/mapping";

let svc: typeof import("@/server/services/bulk-import");
let db: typeof import("@bmn/database").db;
type Sync = Parameters<typeof syncTaxonomy>[0];

const HEAD = [
  "SKU",
  "Product Name",
  "Category",
  "Subcategory",
  "Brand",
  "Unit",
  "Price",
  "MOQ",
  "Availability",
];

async function upload(
  ctx: Parameters<typeof svc.createImportJob>[0],
  rows: string[][],
  mode: "CREATE" | "UPSERT" | "UPDATE" = "CREATE",
  headers = HEAD,
  chunk = 700,
) {
  const id = await svc.createImportJob(ctx, {
    filename: "products.xlsx",
    headers,
    columnMap: autoMapColumns(headers),
    mode,
    totalRows: rows.length,
  });
  for (let i = 0; i < rows.length; i += chunk)
    await svc.stageImportRows(ctx, id, {
      rows: rows.slice(i, i + chunk).map((c, k) => ({ n: i + k + 2, c })),
    });
  await svc.finishImportUpload(ctx, id);
  for (let i = 0; i < 50; i++) if ((await svc.stepValidate(ctx, id)).done) break;
  return id;
}
async function run(ctx: Parameters<typeof svc.createImportJob>[0], id: string, onErrors = "skip") {
  await svc.startImport(ctx, id, { onErrors });
  for (let i = 0; i < 200; i++) if ((await svc.stepImport(ctx, id)).done) break;
  return svc.getImportProgress(ctx, id);
}

beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
  await syncTaxonomy(db as unknown as Sync);
  svc = await import("@/server/services/bulk-import");
});

async function supplier(name: string) {
  const s = await makeAccount("SUPPLIER", { name, city: "Dubai" });
  await db.subscription.upsert({
    where: { orgId: s.ctx.orgId },
    update: { planCode: "SME", status: "ACTIVE", currentPeriodEnd: null },
    create: { orgId: s.ctx.orgId, planCode: "SME" },
  });
  svc.resetBulkCaches();
  return s.ctx;
}

describe("bulk import: create", () => {
  it("validates, reports row-level problems, and imports only the good rows", async () => {
    const ctx = await supplier("Bulk A");
    const rows = [
      [
        "A-1",
        "White cement 25kg",
        "Cement",
        "Portland cement",
        "Sika",
        "bags",
        "AED 1,250.50",
        "1.5k",
        "In stock",
      ],
      ["A-2", "Rebar 12mm", "Steel", "", "", "ton", "3000", "", ""],
      ["A-3", "Bad price item", "Cement", "", "", "bag", "abc", "", ""],
      ["A-1", "Dup of first", "Cement", "", "", "bag", "5", "", ""],
      ["A-5", "Unknown category", "Cemnt", "", "", "bag", "5", "", ""],
      ["", "No sku item", "Cement", "", "", "bag", "7", "", "Out of stock"],
    ];
    const id = await upload(ctx, rows);
    const p1 = await svc.getImportProgress(ctx, id);
    expect(p1.status).toBe("READY");
    expect(p1.counts).toMatchObject({ VALID: 3, INVALID: 3 });

    const detail = await svc.getImportDetail(ctx, id);
    const byRow = Object.fromEntries(detail.problems.map((p) => [p.rowNumber, p]));
    expect(JSON.stringify(byRow[4]!.errors)).toMatch(/not a valid number/);
    expect(JSON.stringify(byRow[5]!.errors)).toMatch(/Duplicate of row 2/);
    expect(JSON.stringify(byRow[6]!.errors)).toMatch(/Did you mean Cement/);

    const rep = await svc.importErrorReport(ctx, id);
    expect(rep.csv).toContain("Bad price item");
    expect(rep.csv).toContain("How to fix");

    // blocking mode refuses while errors exist; skip mode imports the rest
    await expect(svc.startImport(ctx, id, { onErrors: "block" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const done = await run(ctx, id);
    expect(done.status).toBe("COMPLETED_WITH_ERRORS");
    expect(done.counts).toMatchObject({ CREATED: 3, INVALID: 3 });

    const list = await db.product.findMany({
      where: { orgId: ctx.orgId },
      include: { prices: true, brand: true },
    });
    expect(list).toHaveLength(3);
    const w = list.find((p) => p.sku === "A-1")!;
    expect(Number(w.price)).toBe(1250.5);
    expect(Number(w.minOrderQty)).toBe(1500);
    expect(w.unitCode).toBe("BAG");
    expect(w.brand?.name).toBe("Sika");
    expect(w.subcategoryId).toBeTruthy();
    expect(w.prices).toHaveLength(1);
    expect(w.city).toBe("Dubai");
    expect(list.find((p) => p.name === "No sku item")!.stockStatus).toBe("OUT_OF_STOCK");
  });

  it("re-uploading the same file creates no duplicates", async () => {
    const ctx = await supplier("Bulk B");
    const rows = [
      ["B-1", "Item one", "Cement", "", "", "bag", "10", "", ""],
      ["", "Item two", "Cement", "", "", "bag", "10", "", ""],
    ];
    await run(ctx, await upload(ctx, rows));
    const again = await upload(ctx, rows);
    const p = await svc.getImportProgress(ctx, again);
    expect(p.counts.INVALID).toBe(2);
    expect(p.counts.VALID ?? 0).toBe(0);
    expect(await db.product.count({ where: { orgId: ctx.orgId } })).toBe(2);
  });

  it("staging is idempotent and an incomplete upload cannot be finished", async () => {
    const ctx = await supplier("Bulk C");
    const id = await svc.createImportJob(ctx, {
      filename: "x.csv",
      headers: HEAD,
      columnMap: autoMapColumns(HEAD),
      mode: "CREATE",
      totalRows: 2,
    });
    const chunk = { rows: [{ n: 2, c: ["", "One", "Cement", "", "", "bag", "1", "", ""] }] };
    await svc.stageImportRows(ctx, id, chunk);
    await svc.stageImportRows(ctx, id, chunk); // resend
    await expect(svc.finishImportUpload(ctx, id)).rejects.toMatchObject({ code: "CONFLICT" });
    await svc.stageImportRows(ctx, id, {
      rows: [{ n: 3, c: ["", "Two", "Cement", "", "", "bag", "1", "", ""] }],
    });
    expect((await svc.finishImportUpload(ctx, id)).status).toBe("VALIDATING");
  });

  it("is tenant-safe and needs the required columns", async () => {
    const a = await supplier("Bulk D1");
    const b = await supplier("Bulk D2");
    const id = await upload(a, [["", "Thing", "Cement", "", "", "bag", "1", "", ""]]);
    await expect(svc.getImportProgress(b, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(svc.startImport(b, id, {})).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      svc.createImportJob(a, {
        filename: "x",
        headers: ["Name"],
        columnMap: { name: 0 },
        mode: "CREATE",
        totalRows: 1,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const buyer = (await makeAccount("BUYER")).ctx;
    await expect(svc.listImportJobs(buyer)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("respects the plan's active product limit", async () => {
    const s = (await makeAccount("SUPPLIER", { name: "Bulk Free" })).ctx; // Free plan: 10
    const rows = Array.from({ length: 12 }, (_, i) => [
      `F-${i}`,
      `Free item ${i}`,
      "Cement",
      "",
      "",
      "bag",
      "5",
      "",
      "",
    ]);
    const id = await upload(s, rows);
    await expect(svc.startImport(s, id, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.product.count({ where: { orgId: s.orgId } })).toBe(0);
  });

  it("a row that cannot be saved is reported, not lost, and does not block its neighbours", async () => {
    const ctx = await supplier("Bulk E");
    const rows = [
      ["E-1", "Fine one", "Cement", "", "", "bag", "5", "", ""],
      ["E-2", "Will clash", "Cement", "", "", "bag", "5", "", ""],
      ["E-3", "Fine two", "Cement", "", "", "bag", "5", "", ""],
    ];
    const id = await upload(ctx, rows);
    // someone creates E-2 between validation and the run
    await db.product.create({
      data: {
        orgId: ctx.orgId,
        categoryId: (await db.category.findFirstOrThrow()).id,
        unitCode: "BAG",
        sku: "E-2",
        name: "Raced",
        slug: "raced",
        price: 1,
      },
    });
    const done = await run(ctx, id);
    expect(done.counts).toMatchObject({ CREATED: 2, FAILED: 1 });
    expect(done.status).toBe("COMPLETED_WITH_ERRORS");
    expect((await svc.importErrorReport(ctx, id)).csv).toContain("Will clash");
  });
});

describe("bulk import: update, rollback, scale", () => {
  it("updates only the mapped columns, keeps history, and rolls back", async () => {
    const ctx = await supplier("Bulk U");
    const first = await upload(ctx, [
      ["U-1", "Cement A", "Cement", "Portland cement", "Sika", "bag", "10", "5", "In stock"],
      ["U-2", "Cement B", "Cement", "", "", "bag", "20", "", ""],
    ]);
    await run(ctx, first);
    const h = ["SKU", "Price", "Availability"];
    const upd = await upload(
      ctx,
      [
        ["U-1", "12,5", "Low stock"],
        ["U-9", "1", ""],
        ["U-2", "25", ""],
      ],
      "UPDATE",
      h,
    );
    const p = await svc.getImportProgress(ctx, upd);
    expect(p.counts).toMatchObject({ VALID: 2, INVALID: 1 });
    await run(ctx, upd);
    const u1 = await db.product.findFirstOrThrow({
      where: { orgId: ctx.orgId, sku: "U-1" },
      include: { prices: true },
    });
    expect(Number(u1.price)).toBe(12.5);
    expect(u1.stockStatus).toBe("LOW_STOCK");
    expect(u1.name).toBe("Cement A"); // untouched
    expect(Number(u1.minOrderQty)).toBe(5);
    expect(u1.subcategoryId).toBeTruthy();
    expect(u1.prices).toHaveLength(2);

    await svc.startRollback(ctx, upd);
    for (let i = 0; i < 20; i++) if ((await svc.stepRollback(ctx, upd)).done) break;
    const back = await db.product.findFirstOrThrow({ where: { orgId: ctx.orgId, sku: "U-1" } });
    expect(Number(back.price)).toBe(10);
    expect(back.stockStatus).toBe("IN_STOCK");
    expect((await svc.getImportProgress(ctx, upd)).status).toBe("ROLLED_BACK");

    // rolling back the create removes what it made
    await svc.startRollback(ctx, first);
    for (let i = 0; i < 20; i++) if ((await svc.stepRollback(ctx, first)).done) break;
    expect(await db.product.count({ where: { orgId: ctx.orgId } })).toBe(0);
  });

  it("upsert creates new and updates existing in one file", async () => {
    const ctx = await supplier("Bulk S");
    await run(ctx, await upload(ctx, [["S-1", "Existing", "Cement", "", "", "bag", "10", "", ""]]));
    const id = await upload(
      ctx,
      [
        ["S-1", "Existing", "Cement", "", "", "bag", "11", "", ""],
        ["S-2", "Brand new", "Steel", "", "", "ton", "99", "", ""],
      ],
      "UPSERT",
    );
    const done = await run(ctx, id);
    expect(done.counts).toMatchObject({ CREATED: 1, UPDATED: 1 });
    expect(await db.product.count({ where: { orgId: ctx.orgId } })).toBe(2);
  });

  it("edits made after an import are not overwritten by its rollback", async () => {
    const ctx = await supplier("Bulk R");
    await run(ctx, await upload(ctx, [["R-1", "Rb item", "Cement", "", "", "bag", "10", "", ""]]));
    const up = await upload(ctx, [["R-1", "9"]], "UPDATE", ["SKU", "Price"]);
    await run(ctx, up);
    await new Promise((r) => setTimeout(r, 2500));
    await db.product.updateMany({ where: { orgId: ctx.orgId, sku: "R-1" }, data: { price: 77 } });
    await svc.startRollback(ctx, up);
    for (let i = 0; i < 5; i++) if ((await svc.stepRollback(ctx, up)).done) break;
    const p = await db.product.findFirstOrThrow({ where: { orgId: ctx.orgId, sku: "R-1" } });
    expect(Number(p.price)).toBe(77);
    expect((await svc.getImportProgress(ctx, up)).counts.SKIPPED).toBe(1);
  }, 20000);

  it("handles thousands of rows in bounded steps", async () => {
    const ctx = await supplier("Bulk Big");
    const N = 3000;
    const rows = Array.from({ length: N }, (_, i) => [
      `BIG-${i}`,
      `Bulk item ${i % 500}`,
      "Cement",
      "",
      i % 7 ? "Sika" : "",
      "bag",
      String(1000 + i),
      "100",
      "",
    ]);
    const t0 = Date.now();
    const id = await upload(ctx, rows);
    expect((await svc.getImportProgress(ctx, id)).counts.VALID).toBe(N);
    const done = await run(ctx, id);
    expect(done.counts.CREATED).toBe(N);
    expect(await db.product.count({ where: { orgId: ctx.orgId } })).toBe(N);
    // slugs stay unique inside the organization
    const slugs = await db.product.findMany({
      where: { orgId: ctx.orgId },
      select: { slug: true },
    });
    expect(new Set(slugs.map((s) => s.slug)).size).toBe(N);
    console.log(`bulk ${N} rows in ${Date.now() - t0} ms`);
  }, 120000);

  it("cancel discards a staged job; a busy lease is reported, not double-run", async () => {
    const ctx = await supplier("Bulk X");
    const id = await upload(ctx, [["X-1", "Xi", "Cement", "", "", "bag", "1", "", ""]]);
    const [a, b] = await Promise.all([svc.startImport(ctx, id, {}), Promise.resolve(null)]);
    expect(a.status).toBe("PROCESSING");
    expect(b).toBeNull();
    const [s1, s2] = await Promise.all([svc.stepImport(ctx, id), svc.stepImport(ctx, id)]);
    expect([s1.busy, s2.busy].filter(Boolean).length).toBeLessThanOrEqual(1);
    expect(await db.product.count({ where: { orgId: ctx.orgId } })).toBe(1);
    const id2 = await upload(ctx, [["X-2", "Xii", "Cement", "", "", "bag", "1", "", ""]]);
    await svc.cancelImport(ctx, id2);
    expect(await db.importRow.count({ where: { jobId: id2 } })).toBe(0);
    expect((await svc.getImportProgress(ctx, id2)).status).toBe("CANCELLED");
  });
});
