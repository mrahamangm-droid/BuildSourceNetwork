import { describe, expect, it } from "vitest";
import { buildCompareRows, parseCompareIds, type CompareProduct } from "../src/lib/product-compare";

const money = (n: number, c: string) => `${c} ${n.toFixed(2)}`;
const mk = (id: string, o: Partial<CompareProduct> = {}): CompareProduct => ({
  id,
  name: id,
  price: 10,
  currency: "AED",
  unit: "bag",
  minOrderQty: 1,
  stockStatus: "IN_STOCK",
  ratingAvg: null,
  ratingCount: 0,
  breaks: [],
  fields: {},
  specs: {},
  ...o,
});

describe("parseCompareIds", () => {
  it("dedupes, trims, drops junk and caps at four", () => {
    expect(
      parseCompareIds(" abcdefgh1 ,abcdefgh1,x,abcdefgh2,<script>,abcdefgh3,abcdefgh4,abcdefgh5"),
    ).toEqual(["abcdefgh1", "abcdefgh2", "abcdefgh3", "abcdefgh4"]);
    expect(parseCompareIds(undefined)).toEqual([]);
  });
});

describe("buildCompareRows", () => {
  it("ranks price only when unit and currency match, and never on ties", () => {
    const rows = buildCompareRows([mk("a", { price: 12 }), mk("b", { price: 9 })], money);
    expect(rows.find((r) => r.key === "price")).toMatchObject({ best: 1, differs: true });
    const mixed = buildCompareRows([mk("a"), mk("b", { unit: "tonne", price: 1 })], money);
    expect(mixed.find((r) => r.key === "price")!.best).toBeNull();
    const tie = buildCompareRows([mk("a"), mk("b")], money);
    expect(tie.find((r) => r.key === "price")).toMatchObject({ best: null, differs: false });
  });

  it("flags differences, skips empty rows, and merges specifications", () => {
    const rows = buildCompareRows(
      [
        mk("a", {
          fields: { brand: "Sika", color: null },
          specs: { Strength: "42 MPa" },
          ratingAvg: 4.5,
          ratingCount: 3,
        }),
        mk("b", { fields: { brand: "sika", color: null }, specs: { Weight: "50 kg" } }),
      ],
      money,
    );
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by.brand!.differs).toBe(false); // case-insensitive
    expect(by.color).toBeUndefined(); // nobody has it
    expect(by["spec:Strength"]!.values).toEqual(["42 MPa", null]);
    expect(by["spec:Weight"]!.differs).toBe(true);
    expect(by.rating!.best).toBeNull(); // only one product is rated
  });
});
