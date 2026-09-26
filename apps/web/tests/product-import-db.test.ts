import { beforeAll, describe, expect, it } from "vitest";
import { makeAccount, resetDb } from "./helpers";

let products: typeof import("@/server/services/products");
let db: typeof import("@bmn/database").db;

const row = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  categoryName: "Cement",
  unitCode: "BAG",
  price: 12.5,
  ...extra,
});

beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
  products = await import("@/server/services/products");
});

describe("bulk product import", () => {
  it("previews rows, sets aside SKUs already in the catalogue, and saves nothing", async () => {
    const s = await makeAccount("SUPPLIER", { name: "Import Supply A" });
    await products.importProducts(s.ctx, [row("Existing item", { sku: "EX-1" })]);
    const before = await db.product.count({ where: { orgId: s.ctx.orgId } });
    const csv = [
      "Name,Category,Unit,Price,SKU",
      "New cement,Cement,bag,10,NEW-1",
      "Clash,Cement,bag,10,ex-1",
      "Bad unit,Cement,furlong,10,",
    ].join("\n");
    const r = await products.previewProductImport(s.ctx, csv);
    expect(r.rows.map((x) => x.name)).toEqual(["New cement"]);
    expect(r.issues).toHaveLength(2);
    expect(await db.product.count({ where: { orgId: s.ctx.orgId } })).toBe(before);
  });

  it("imports products with brand, price history and a unique slug per organization", async () => {
    const s = await makeAccount("SUPPLIER", { name: "Import Supply B", city: "Ajman" });
    const n = await products.importProducts(s.ctx, [
      row("Portland cement", { brandName: "ImportBrand", sku: "P-1", wholesalePrice: 11 }),
      row("Portland cement", { stockStatus: "LOW_STOCK" }),
    ]);
    expect(n).toBe(2);
    const list = await db.product.findMany({
      where: { orgId: s.ctx.orgId },
      include: { brand: true, prices: true },
      orderBy: { createdAt: "asc" },
    });
    expect(list.map((p) => p.slug).sort()).toEqual(["portland-cement", "portland-cement-2"]);
    const first = list.find((p) => p.sku === "P-1")!;
    expect(first.brand?.name).toBe("ImportBrand");
    expect(first.prices).toHaveLength(1);
    expect(first.city).toBe("Ajman"); // defaults to the organization's city
    expect(first.isActive).toBe(true);
  });

  it("rejects an import that would reuse a SKU, and creates nothing", async () => {
    const s = await makeAccount("SUPPLIER", { name: "Import Supply C" });
    await products.importProducts(s.ctx, [row("First", { sku: "DUP" })]);
    await expect(
      products.importProducts(s.ctx, [row("Second"), row("Third", { sku: "dup" })]),
    ).rejects.toThrow(/SKU/);
    expect(await db.product.count({ where: { orgId: s.ctx.orgId } })).toBe(1);
  });

  it("re-validates rows on the server", async () => {
    const s = await makeAccount("SUPPLIER", { name: "Import Supply D" });
    await expect(products.importProducts(s.ctx, [row("Ok", { price: -5 })])).rejects.toThrow();
    await expect(
      products.importProducts(s.ctx, [row("Ok", { categoryName: "Not a category" })]),
    ).rejects.toThrow(/category/i);
    await expect(products.importProducts(s.ctx, [row("Ok", { unitCode: "ZZZ" })])).rejects.toThrow(
      /unit/i,
    );
    await expect(products.importProducts(s.ctx, [])).rejects.toThrow();
  });

  it("respects the plan's active-product limit", async () => {
    const s = await makeAccount("SUPPLIER", { name: "Import Supply E" });
    const limit = (await db.subscriptionPlan.findUniqueOrThrow({ where: { code: "FREE" } }))
      .productLimit;
    if (limit === null) return; // unlimited plan: nothing to assert
    const tooMany = Array.from({ length: limit + 1 }, (_, i) => row(`Bulk ${i}`));
    await expect(products.importProducts(s.ctx, tooMany)).rejects.toThrow(/plan allows/);
    expect(await db.product.count({ where: { orgId: s.ctx.orgId } })).toBe(0);
    expect(await products.importProducts(s.ctx, tooMany.slice(0, limit))).toBe(limit);
  });

  it("is limited to verified suppliers and stores", async () => {
    const buyer = await makeAccount("CONTRACTOR", { name: "Import Buyer" });
    const unverified = await makeAccount("SUPPLIER", { verify: false, name: "Import Unverified" });
    await expect(products.importProducts(buyer.ctx, [row("Nope")])).rejects.toThrow();
    await expect(products.importProducts(unverified.ctx, [row("Nope")])).rejects.toThrow();
    await expect(products.previewProductImport(buyer.ctx, "Name,Price\nX,1")).rejects.toThrow();
  });
});
