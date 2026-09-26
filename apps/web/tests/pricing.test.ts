import { describe, expect, it } from "vitest";
import { lineTotal, savingsPercent, unitPriceFor, validateBreaks } from "../src/lib/pricing";

const breaks = [
  { minQty: 100, price: 22 },
  { minQty: 500, price: 20.5 },
];

describe("unitPriceFor", () => {
  it("uses the base price below the first break", () => {
    expect(unitPriceFor(25, breaks, 99.999)).toBe(25);
  });
  it("switches exactly at a break quantity", () => {
    expect(unitPriceFor(25, breaks, 100)).toBe(22);
    expect(unitPriceFor(25, breaks, 499)).toBe(22);
    expect(unitPriceFor(25, breaks, 500)).toBe(20.5);
  });
  it("does not depend on break order", () => {
    expect(unitPriceFor(25, [...breaks].reverse(), 600)).toBe(20.5);
  });
  it("never charges more than the base price when a break is stale", () => {
    expect(unitPriceFor(21, breaks, 150)).toBe(21);
  });
  it("handles no breaks", () => {
    expect(unitPriceFor(25, [], 1000)).toBe(25);
  });
});

describe("lineTotal", () => {
  it("is exact in cents", () => {
    expect(lineTotal(25, breaks, 0.1)).toBe(2.5);
    expect(lineTotal(25, breaks, 500)).toBe(10250);
    expect(lineTotal(19.99, [], 3)).toBe(59.97);
  });
});

describe("savingsPercent", () => {
  it("rounds to one decimal", () => {
    expect(savingsPercent(25, 22)).toBe(12);
    expect(savingsPercent(25, 20.5)).toBe(18);
    expect(savingsPercent(0, 5)).toBe(0);
  });
});

describe("validateBreaks", () => {
  const product = { price: 25, minOrderQty: 10 };
  it("accepts a valid table and sorts it", () => {
    const r = validateBreaks([breaks[1], breaks[0]], product);
    expect(r.issues).toEqual([]);
    expect(r.sorted.map((b) => b.minQty)).toEqual([100, 500]);
  });
  it("rejects breaks at or below the minimum order", () => {
    const r = validateBreaks([{ minQty: 10, price: 20 }], product);
    expect(r.issues[0]).toMatchObject({ row: 0, field: "minQty" });
  });
  it("rejects a price not below base", () => {
    const r = validateBreaks([{ minQty: 50, price: 25 }], product);
    expect(r.issues[0]).toMatchObject({ field: "price" });
  });
  it("rejects a larger quantity that is not cheaper", () => {
    const r = validateBreaks(
      [
        { minQty: 100, price: 20 },
        { minQty: 200, price: 21 },
      ],
      product,
    );
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ row: 1, field: "price" });
  });
  it("rejects duplicate quantities", () => {
    const r = validateBreaks(
      [
        { minQty: 100, price: 20 },
        { minQty: 100, price: 19 },
      ],
      product,
    );
    expect(r.issues[0].message).toMatch(/same quantity/);
  });
  it("caps the number of breaks", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ minQty: 100 + i, price: 20 - i }));
    expect(validateBreaks(many, product).issues.length).toBeGreaterThan(0);
  });
});
