import { describe, expect, it } from "vitest";
import { autoMapColumns, detectHeaderRow, missingRequired } from "../src/lib/bulk/mapping";
import { REQUIRED_FIELDS } from "../src/lib/bulk/fields";
import { validateRow, missingForCreate, dedupeKey, type Refs } from "../src/lib/bulk/validate";
import { buildErrorReport } from "../src/lib/bulk/report";
import { parseCsv } from "../src/lib/bulk/csv";
import { closest } from "../src/lib/bulk/suggest";

const refs: Refs = {
  categories: [
    { id: "c1", name: "Cement", slug: "cement" },
    { id: "c2", name: "Steel", slug: "steel" },
  ],
  subcategories: [
    { id: "s1", categoryId: "c1", name: "Portland cement", slug: "portland-cement" },
    { id: "s2", categoryId: "c2", name: "Rebar", slug: "rebar" },
  ],
  types: [{ id: "t1", subcategoryId: "s1", name: "White cement", slug: "white-cement" }],
  unitCodes: ["BAG", "TON", "M2", "PCS"],
};

describe("column mapping", () => {
  it("maps typical headers, keeping wholesale apart from retail price", () => {
    const m = autoMapColumns([
      "Item Code",
      "Product Name *",
      "Category",
      "Sub-category",
      "Brand",
      "UOM",
      "Price (AED)",
      "Wholesale Price",
      "MOQ",
      "Availability",
      "Qty on hand",
    ]);
    expect(m).toMatchObject({
      sku: 0,
      name: 1,
      category: 2,
      subcategory: 3,
      brand: 4,
      unit: 5,
      price: 6,
      wholesalePrice: 7,
      minOrderQty: 8,
      stockStatus: 9,
      stockQty: 10,
    });
  });
  it("finds the header row below a title block", () => {
    const rows = [
      ["ACME price list 2026"],
      [""],
      ["Name", "Category", "Unit", "Price"],
      ["x", "Cement", "bag", "1"],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
  });
  it("reports missing required columns, except for SKU-based updates", () => {
    expect(missingRequired({ name: 0, price: 1 }, REQUIRED_FIELDS)).toEqual(["category", "unit"]);
    expect(missingRequired({ sku: 0, price: 1 }, REQUIRED_FIELDS, true)).toEqual([]);
  });
});

const map = {
  sku: 0,
  name: 1,
  category: 2,
  subcategory: 3,
  productType: 4,
  unit: 5,
  price: 6,
  minOrderQty: 7,
  stockStatus: 8,
  stockQty: 9,
};

describe("validateRow", () => {
  it("accepts a clean row and normalises values", () => {
    const r = validateRow(
      [
        "A-1",
        "White cement 25kg",
        "cement",
        "Portland cement",
        "White cement",
        "bags",
        "AED 1,250.50",
        "1.5k",
        "",
        "0",
      ],
      map,
      refs,
    );
    expect(r.errors).toEqual([]);
    expect(r.values).toMatchObject({
      sku: "A-1",
      categoryId: "c1",
      subcategoryId: "s1",
      productTypeId: "t1",
      unitCode: "BAG",
      price: 1250.5,
      minOrderQty: 1500,
      stockStatus: "OUT_OF_STOCK",
    });
    expect(missingForCreate(r.values)).toEqual([]);
  });
  it("gives row-level errors with a fix and a did-you-mean", () => {
    const r = validateRow(
      ["", "X", "Cemnt", "Rebar", "", "bagz", "abc", "-3", "maybe", ""],
      map,
      refs,
    );
    const by = Object.fromEntries(r.errors.map((e) => [e.field, e]));
    expect(by.name?.message).toMatch(/too short/);
    expect(by.category?.fix).toBe("Did you mean Cement?");
    expect(by.unit?.fix).toBe("Did you mean BAG?");
    expect(by.price?.message).toMatch(/not a valid number/);
    expect(by.minOrderQty).toBeTruthy();
    expect(by.stockStatus).toBeTruthy();
  });
  it("checks subcategory and type against their parent", () => {
    const r = validateRow(
      ["", "Pipe", "Cement", "Rebar", "White cement", "PCS", "5", "", "", ""],
      map,
      refs,
    );
    expect(r.errors.map((e) => e.field)).toContain("subcategory");
  });
  it("infers a category from a unique subcategory and flags it", () => {
    const r = validateRow(["", "Bar", "", "Rebar", "", "TON", "5", "", "", ""], map, refs);
    expect(r.values.categoryId).toBe("c2");
    expect(r.warnings.some((w) => w.field === "category")).toBe(true);
  });
  it("only returns mapped, non-empty fields so updates stay partial", () => {
    const r = validateRow(["SKU9", "", "", "", "", "", "42", "", "", ""], map, refs);
    expect(r.values).toEqual({ sku: "SKU9", price: 42 });
    expect(missingForCreate(r.values).map((e) => e.field)).toEqual(["name", "category", "unit"]);
  });
  it("dedupes by sku, else by name+brand+unit", () => {
    expect(dedupeKey({ sku: "AB" })).toBe(dedupeKey({ sku: "ab" }));
    expect(dedupeKey({ name: "A", unitCode: "BAG" })).not.toBe(
      dedupeKey({ name: "A", unitCode: "TON" }),
    );
  });
});

describe("error report and suggestions", () => {
  it("keeps original cells and appends the problem", () => {
    const csv = buildErrorReport(
      ["Name", "Price"],
      [
        {
          rowNumber: 7,
          cells: ["Foo", "abc"],
          errors: [{ field: "price", message: "bad", fix: "use digits" }],
        },
      ],
    );
    const g = parseCsv(csv.replace(/^﻿/, ""));
    expect(g[0]).toEqual(["Row", "Name", "Price", "Problem", "Column", "How to fix"]);
    expect(g[1]).toEqual(["7", "Foo", "abc", "bad", "price", "use digits"]);
  });
  it("suggests close matches only", () => {
    expect(closest("Stel", ["Cement", "Steel"])).toBe("Steel");
    expect(closest("zzzz", ["Cement", "Steel"])).toBeNull();
  });
});
