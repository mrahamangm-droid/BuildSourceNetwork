import { describe, expect, it } from "vitest";
import { CALCULATORS, concreteMaterials, defaultValues, steelKgPerM } from "@/lib/calculators";

const get = (slug: string, v: Record<string, number | string> = {}) => {
  const c = CALCULATORS.find((x) => x.slug === slug)!;
  return c.compute({ ...defaultValues(c), ...v });
};
const row = (o: ReturnType<typeof get>, label: string) => o.rows.find((r) => r.label === label)!.value;

describe("calculators", () => {
  it("gives ~8 bags of cement per m3 of M20 concrete", () => {
    expect(concreteMaterials(1, "M20").bags).toBeGreaterThan(7.9);
    expect(concreteMaterials(1, "M20").bags).toBeLessThan(8.3);
  });
  it("concrete volume applies wastage", () => {
    const o = get("concrete-calculator", { length: 10, width: 10, depth: 0.1, waste: 10 });
    expect(row(o, "Concrete volume")).toBeCloseTo(11, 6);
  });
  it("rebar weight matches d^2/162.2", () => {
    expect(steelKgPerM(12)).toBeCloseTo(0.888, 3);
    const o = get("steel-calculator", { dia: "12", length: 12, count: 1, waste: 0 });
    expect(row(o, "Total weight")).toBeCloseTo(10.66, 1);
  });
  it("block count deducts openings and joints", () => {
    const o = get("block-calculator", { length: 10, height: 3, openings: 0, joint: 0, waste: 0 });
    expect(row(o, "Units before wastage")).toBe(375);
  });
  it("tiles round up and boxes cover them", () => {
    const o = get("tile-calculator", { length: 3, width: 3, tileL: 300, tileW: 300, gap: 0, waste: 0, perBox: 10 });
    expect(row(o, "Tiles needed")).toBe(100);
    expect(row(o, "Boxes to order")).toBe(10);
  });
  it("paint scales with coats", () => {
    const one = row(get("paint-calculator", { coats: 1, waste: 0 }), "Paint needed");
    const two = row(get("paint-calculator", { coats: 2, waste: 0 }), "Paint needed");
    expect(two).toBeCloseTo(one * 2, 1);
  });
  it("area calculator handles a circle", () => {
    expect(row(get("area-calculator", { shape: "circle", a: 2 }), "Area")).toBeCloseTo(Math.PI, 6);
  });
  it("never returns NaN for empty or zero input", () => {
    for (const c of CALCULATORS) {
      const zero = Object.fromEntries(c.inputs.map((i) => [i.key, i.type === "number" ? 0 : i.default]));
      for (const r of c.compute(zero).rows) expect(Number.isFinite(r.value)).toBe(true);
      for (const r of c.compute({}).rows) expect(Number.isFinite(r.value)).toBe(true);
    }
  });
});
