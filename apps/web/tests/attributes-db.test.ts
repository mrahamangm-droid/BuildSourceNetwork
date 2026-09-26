import { beforeAll, describe, expect, it } from "vitest";
import { MANUFACTURERS } from "@bmn/config";
import { makeAccount, resetDb } from "./helpers";
import { syncManufacturers, syncTaxonomy } from "../../../packages/database/prisma/reference";

let db: typeof import("@bmn/database").db;
type Sync = Parameters<typeof syncManufacturers>[0];

beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
});

describe("syncManufacturers", () => {
  it("loads manufacturers and brands, is idempotent, and never overrides a chosen owner", async () => {
    const sync = db as unknown as Sync;
    await syncManufacturers(sync);
    expect(await db.manufacturer.count()).toBe(MANUFACTURERS.length);
    const sika = await db.manufacturer.findUniqueOrThrow({
      where: { slug: "sika" },
      include: { brands: true },
    });
    expect(sika.brands.map((b) => b.name)).toContain("Sikaflex");

    const brands = await db.brand.count();
    await syncManufacturers(sync);
    expect(await db.brand.count()).toBe(brands);
    expect(await db.manufacturer.count()).toBe(MANUFACTURERS.length);

    // a brand a supplier created earlier gets its owner filled in, but a different owner is kept
    const mine = await db.manufacturer.create({ data: { slug: "my-mill", name: "My Mill" } });
    await db.brand.update({ where: { slug: "sikaflex" }, data: { manufacturerId: mine.id } });
    await syncManufacturers(sync);
    expect((await db.brand.findUniqueOrThrow({ where: { slug: "sikaflex" } })).manufacturerId).toBe(
      mine.id,
    );
  });
});

describe("product attributes", () => {
  it("stores attributes and manufacturer, defaults the manufacturer from the brand, and filters", async () => {
    await syncTaxonomy(db as unknown as Parameters<typeof syncTaxonomy>[0]);
    await syncManufacturers(db as unknown as Sync);
    const products = await import("@/server/services/products");
    const s = await makeAccount("SUPPLIER", { name: "Attribute Supply" });
    const tiles = await db.category.findUniqueOrThrow({ where: { slug: "tiles" } });
    const base = { categoryId: tiles.id, unitCode: "SQM", price: 45 };

    const a = await products.createProduct(s.ctx, {
      ...base,
      name: "Porcelain tile grey",
      brandName: "RAK Ceramics",
      material: "Porcelain",
      grade: "AA grade",
      color: "Grey",
      finish: "Matt",
      size: "600 x 600 mm",
      dimensions: "600 x 600 x 10 mm",
      application: "Flooring",
      countryOfOrigin: "United Arab Emirates",
    });
    expect(a.material).toBe("Porcelain");
    expect(a.countryOfOrigin).toBe("United Arab Emirates");
    const rak = await db.manufacturer.findUniqueOrThrow({ where: { slug: "rak-ceramics" } });
    expect(a.manufacturerId).toBe(rak.id); // inherited from the known brand

    const b = await products.createProduct(s.ctx, {
      ...base,
      name: "Ceramic tile white",
      brandName: "RAK Ceramics",
      manufacturerName: "Local Tile Works",
      material: "Ceramic",
      color: "White",
      finish: "Gloss",
    });
    const local = await db.manufacturer.findUniqueOrThrow({ where: { slug: "local-tile-works" } });
    expect(b.manufacturerId).toBe(local.id); // an explicit manufacturer wins
    const plain = await products.createProduct(s.ctx, { ...base, name: "Plain tile" });
    expect(plain.material).toBeNull();
    expect(plain.manufacturerId).toBeNull();

    const names = async (f: Parameters<typeof products.searchProducts>[0]) =>
      (await products.searchProducts(f)).items.map((i) => i.name).sort();
    expect(await names({ material: "porcelain" })).toEqual(["Porcelain tile grey"]);
    expect(await names({ color: "White", finish: "Gloss" })).toEqual(["Ceramic tile white"]);
    expect(await names({ color: "White", finish: "Matt" })).toEqual([]);
    expect(await names({ manufacturer: "rak-ceramics" })).toEqual(["Porcelain tile grey"]);
    expect(await names({ application: "Flooring" })).toEqual(["Porcelain tile grey"]);
    expect(await names({ q: "porcelain" })).toEqual(["Porcelain tile grey"]);

    // editing keeps or clears attributes
    const updated = await products.updateProduct(s.ctx, a.id, {
      ...base,
      name: "Porcelain tile grey",
      brandName: "RAK Ceramics",
      material: "",
    });
    expect(updated.material).toBeNull();
  });
});
