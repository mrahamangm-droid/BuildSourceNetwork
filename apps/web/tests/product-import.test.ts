import { describe, expect, it } from "vitest";
import {
  PRODUCT_IMPORT_MAX_ROWS,
  mapProductHeader,
  parseProductList,
  parseStock,
  productImportRowsSchema,
} from "@/lib/product-import";

const refs = {
  categories: ["Cement", "Steel", "Blocks", "Tiles", "Paint", "Other construction materials"],
  unitCodes: ["BAG", "TON", "PIECE", "SQM", "KG", "LITER"],
};

describe("mapProductHeader", () => {
  it("needs a name and a price column", () => {
    expect(mapProductHeader(["Name", "Unit"])).toBeNull();
    expect(mapProductHeader(["Name", "Price"])).not.toBeNull();
  });
  it("does not mistake 'Unit price' for the unit or 'Wholesale price' for the retail price", () => {
    const h = mapProductHeader(["Product", "Unit price", "Wholesale price", "Unit"])!;
    expect(h.price).toBe(1);
    expect(h.wholesale).toBe(2);
    expect(h.unit).toBe(3);
  });
  it("uses a lone Description column as the name", () => {
    const h = mapProductHeader(["Description", "Price"])!;
    expect(h.name).toBe(0);
    expect(h.desc).toBe(-1);
  });
  it("keeps a real Description column as details when a Name column exists", () => {
    const h = mapProductHeader(["Name", "Description", "Price"])!;
    expect(h.name).toBe(0);
    expect(h.desc).toBe(1);
  });
  it("reads a product code as SKU, not as the name", () => {
    const h = mapProductHeader(["Product code", "Name", "Price"])!;
    expect(h.sku).toBe(0);
    expect(h.name).toBe(1);
  });
});

describe("parseStock", () => {
  it("maps common words and defaults blank to in stock", () => {
    expect(parseStock("")).toBe("IN_STOCK");
    expect(parseStock("Available")).toBe("IN_STOCK");
    expect(parseStock("low stock")).toBe("LOW_STOCK");
    expect(parseStock("Out of stock")).toBe("OUT_OF_STOCK");
    expect(parseStock("on-request")).toBe("ON_REQUEST");
    expect(parseStock("maybe")).toBeNull();
  });
});

describe("parseProductList", () => {
  it("reads a complete CSV row", () => {
    const csv = [
      "Name,Category,Brand,Unit,Price,Wholesale price,Min qty,Stock,SKU,City,VAT %",
      '"OPC Cement 50kg, 42.5N",Cement,Acme,bag,18.5,17.25,10,In stock,OPC-50,Ras Al Khaimah,5%',
    ].join("\n");
    const r = parseProductList(csv, refs);
    expect(r.issues).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      name: "OPC Cement 50kg, 42.5N",
      categoryName: "Cement",
      brandName: "Acme",
      unitCode: "BAG",
      price: 18.5,
      wholesalePrice: 17.25,
      contractorPrice: null,
      minOrderQty: 10,
      stockStatus: "IN_STOCK",
      sku: "OPC-50",
      city: "Ras Al Khaimah",
      vatRatePercent: 5,
    });
  });

  it("works with tab-separated text pasted from Excel and semicolon files", () => {
    const tsv = "Name\tUnit\tPrice\tCategory\nRebar 12mm\tton\t2,450.00\tSteel";
    expect(parseProductList(tsv, refs).rows[0]).toMatchObject({ price: 2450, unitCode: "TON" });
    const semi = "Name;Unit;Price;Category\nBlock 6in;pcs;3,2;Blocks";
    expect(parseProductList(semi, refs).rows[0]).toMatchObject({ price: 3.2, unitCode: "PIECE" });
  });

  it("guesses the category from the name when the column is empty, but never invents one", () => {
    const csv = "Name,Unit,Price,Category\nPortland cement 50kg,bag,17,\nMystery widget,pcs,5,";
    const r = parseProductList(csv, refs);
    expect(r.rows.map((x) => x.categoryName)).toEqual(["Cement"]);
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]!.message).toMatch(/category/i);
  });

  it("reports bad rows with their row number and keeps the good ones", () => {
    const csv = [
      "Name,Category,Unit,Price",
      "Good cement,Cement,bag,10",
      "No price,Cement,bag,",
      "Bad unit,Cement,furlong,9",
      "Unknown cat,Widgets,bag,9",
      ",Cement,bag,9",
    ].join("\n");
    const r = parseProductList(csv, refs);
    expect(r.rows).toHaveLength(1);
    expect(r.issues.map((i) => i.row)).toEqual([3, 4, 5, 6]);
    expect(r.issues[1]!.message).toMatch(/unit/i);
  });

  it("rejects zero, negative and absurd prices", () => {
    const csv =
      "Name,Category,Unit,Price\nA item,Cement,bag,0\nB item,Cement,bag,-3\nC item,Cement,bag,9999999999";
    const r = parseProductList(csv, refs);
    expect(r.rows).toHaveLength(0);
    expect(r.issues).toHaveLength(3);
  });

  it("flags duplicate SKUs and duplicate unlabeled rows inside the file", () => {
    const csv = [
      "Name,Category,Unit,Price,SKU",
      "Item one,Cement,bag,10,X1",
      "Item two,Cement,bag,11,x1",
      "Item three,Cement,bag,12,",
      "Item three,Cement,bag,12,",
    ].join("\n");
    const r = parseProductList(csv, refs);
    expect(r.rows.map((x) => x.name)).toEqual(["Item one", "Item three"]);
    expect(r.issues).toHaveLength(2);
  });

  it("returns nothing when there is no usable header", () => {
    expect(parseProductList("just some words\nand more", refs).rows).toEqual([]);
    expect(parseProductList("", refs).rows).toEqual([]);
  });

  it(`caps a file at ${PRODUCT_IMPORT_MAX_ROWS} rows`, () => {
    const body = Array.from(
      { length: PRODUCT_IMPORT_MAX_ROWS + 5 },
      (_, i) => `Item ${i},Cement,bag,${i + 1}`,
    );
    const r = parseProductList(["Name,Category,Unit,Price", ...body].join("\n"), refs);
    expect(r.rows).toHaveLength(PRODUCT_IMPORT_MAX_ROWS);
    expect(r.truncated).toBe(true);
  });

  it("strips control characters from text fields", () => {
    const r = parseProductList("Name,Category,Unit,Price\nCement\u0007 50kg,Cement,bag,9", refs);
    expect(r.rows[0]!.name).toBe("Cement 50kg");
  });
});

describe("productImportRowsSchema", () => {
  const row = {
    name: "Cement",
    categoryName: "Cement",
    unitCode: "BAG",
    price: 10,
  };
  it("accepts a minimal row and fills defaults", () => {
    const r = productImportRowsSchema.parse([row]);
    expect(r[0]).toMatchObject({ minOrderQty: 1, stockStatus: "IN_STOCK", vatRatePercent: 5 });
  });
  it("rejects empty lists, bad prices and unknown stock values from a tampered client", () => {
    expect(productImportRowsSchema.safeParse([]).success).toBe(false);
    expect(productImportRowsSchema.safeParse([{ ...row, price: -1 }]).success).toBe(false);
    expect(productImportRowsSchema.safeParse([{ ...row, stockStatus: "HACKED" }]).success).toBe(
      false,
    );
    expect(
      productImportRowsSchema.safeParse(
        Array.from({ length: PRODUCT_IMPORT_MAX_ROWS + 1 }, () => row),
      ).success,
    ).toBe(false);
  });
});
