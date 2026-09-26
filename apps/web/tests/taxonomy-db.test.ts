import { beforeAll, describe, expect, it } from "vitest";
import { TAXONOMY, taxonomyCounts } from "@bmn/config";
import { makeAccount, resetDb } from "./helpers";
import { syncTaxonomy } from "../../../packages/database/prisma/reference";

let db: typeof import("@bmn/database").db;
type Sync = Parameters<typeof syncTaxonomy>[0];

beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
});

describe("syncTaxonomy", () => {
  it("loads the whole tree and attaches the original categories to departments", async () => {
    await syncTaxonomy(db as unknown as Sync);
    const c = taxonomyCounts();
    expect(await db.department.count()).toBe(c.departments);
    expect(await db.category.count()).toBe(c.categories);
    expect(await db.subcategory.count()).toBe(c.subcategories);
    expect(await db.productType.count()).toBe(c.types);
    const cement = await db.category.findUniqueOrThrow({
      where: { slug: "cement" },
      include: { department: true, subcategories: { include: { types: true } } },
    });
    expect(cement.department?.slug).toBe("concrete-cement-masonry");
    expect(cement.subcategories.some((s) => s.types.some((t) => t.name === "White cement"))).toBe(
      true,
    );
  });

  it("is idempotent, fixes drift, and never deletes", async () => {
    const before = await db.productType.count();
    await syncTaxonomy(db as unknown as Sync);
    expect(await db.productType.count()).toBe(before);

    const dept = TAXONOMY[0]!;
    await db.department.update({ where: { slug: dept.slug }, data: { name: "Renamed" } });
    await db.productType.create({
      data: {
        name: "Custom extra",
        slug: "custom-extra",
        subcategoryId: (await db.subcategory.findFirstOrThrow()).id,
      },
    });
    await syncTaxonomy(db as unknown as Sync);
    expect((await db.department.findUniqueOrThrow({ where: { slug: dept.slug } })).name).toBe(
      dept.name,
    );
    expect(await db.productType.count()).toBe(before + 1);
  });
});

describe("products in the taxonomy", () => {
  it("stores subcategory and product type, rejects mismatches, and filters the marketplace", async () => {
    const products = await import("@/server/services/products");
    const s = await makeAccount("SUPPLIER", { name: "Taxonomy Supply" });
    const cement = await db.category.findUniqueOrThrow({ where: { slug: "cement" } });
    const steel = await db.category.findUniqueOrThrow({ where: { slug: "steel" } });
    const sub = await db.subcategory.findFirstOrThrow({
      where: { categoryId: cement.id, slug: "portland-cement" },
      include: { types: true },
    });
    const type = sub.types.find((t) => t.slug === "white-cement")!;
    const steelSub = await db.subcategory.findFirstOrThrow({ where: { categoryId: steel.id } });
    const base = { name: "White cement 25kg", categoryId: cement.id, unitCode: "BAG", price: 30 };

    const p = await products.createProduct(s.ctx, {
      ...base,
      subcategoryId: sub.id,
      productTypeId: type.id,
    });
    expect(p.subcategoryId).toBe(sub.id);
    expect(p.productTypeId).toBe(type.id);

    await expect(
      products.createProduct(s.ctx, { ...base, name: "Bad sub", subcategoryId: steelSub.id }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      products.createProduct(s.ctx, { ...base, name: "Type only", productTypeId: type.id }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      products.createProduct(s.ctx, {
        ...base,
        name: "Wrong type",
        subcategoryId: sub.id,
        productTypeId: (
          await db.productType.findFirstOrThrow({ where: { subcategoryId: steelSub.id } })
        ).id,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // a plain category-only product still works
    await products.createProduct(s.ctx, { ...base, name: "Category only" });

    const byType = await products.searchProducts({
      category: "cement",
      subcategory: "portland-cement",
      productType: "white-cement",
    });
    expect(byType.items.map((i) => i.name)).toEqual(["White cement 25kg"]);
    const bySub = await products.searchProducts({
      category: "cement",
      subcategory: "portland-cement",
    });
    expect(bySub.total).toBe(1);
    // a subcategory from another category matches nothing
    const wrong = await products.searchProducts({
      category: "steel",
      subcategory: "portland-cement",
    });
    expect(wrong.total).toBe(0);
    const byText = await products.searchProducts({ q: "white cement" });
    expect(byText.total).toBeGreaterThanOrEqual(1);
  });
});
