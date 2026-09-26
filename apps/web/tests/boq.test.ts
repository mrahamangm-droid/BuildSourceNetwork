import { describe, expect, it } from "vitest";
import { boqCsv, csvCell, lineCostCents, orderQty, starterBoq, summarize } from "../src/lib/boq";

const line = (o: Partial<Parameters<typeof lineCostCents>[0]> = {}) => ({
  quantity: 100,
  wastePercent: 5,
  unitRate: 10,
  ...o,
});

describe("line cost", () => {
  it("adds waste before pricing", () => {
    expect(orderQty(line())).toBe(105);
    expect(lineCostCents(line())).toBe(105000);
  });
  it("is null until a rate exists, and zero rate is a real price", () => {
    expect(lineCostCents(line({ unitRate: null }))).toBeNull();
    expect(lineCostCents(line({ unitRate: 0 }))).toBe(0);
  });
  it("stays exact with awkward decimals", () => {
    expect(lineCostCents({ quantity: 0.1, wastePercent: 0, unitRate: 0.3 })).toBe(3);
  });
});

describe("summarize", () => {
  const items = [
    { section: "A", description: "x", unit: "m2", ...line() },
    { section: "B", description: "y", unit: "m2", ...line({ unitRate: null }) },
    { section: "A", description: "z", unit: "m2", ...line({ quantity: 10, wastePercent: 0 }) },
  ];
  it("groups in first-seen order and separates unpriced lines", () => {
    const s = summarize(items, null);
    expect(s.sections.map((x) => x.section)).toEqual(["A", "B"]);
    expect(s.sections[0].subtotalCents).toBe(105000 + 10000);
    expect(s.unpriced).toBe(1);
    expect(s.totalCents).toBe(115000);
    expect(s.varianceCents).toBeNull();
  });
  it("reports budget variance", () => {
    const s = summarize(items, 2000);
    expect(s.varianceCents).toBe(200000 - 115000);
    expect(s.budgetUsedPercent).toBe(57.5);
  });
  it("handles an empty bill and a zero budget", () => {
    expect(summarize([], 0).budgetUsedPercent).toBeNull();
    expect(summarize([], 0).itemCount).toBe(0);
  });
});

describe("starterBoq", () => {
  it("scales with area and derives steel from concrete", () => {
    const a = starterBoq("VILLA", 300, 2);
    const b = starterBoq("VILLA", 600, 2);
    const conc = (l: typeof a) => l.find((i) => i.description.startsWith("Reinforced"))!.quantity;
    expect(conc(a)).toBe(96);
    expect(conc(b)).toBe(192);
    expect(a.find((i) => i.description === "Reinforcement steel")!.quantity).toBe(10560);
  });
  it("uses the footprint for substructure", () => {
    const l = starterBoq("APARTMENT_BUILDING", 1000, 4);
    expect(l.find((i) => i.description === "Excavation")!.quantity).toBe(375);
  });
  it("refuses bad input and unsupported kinds", () => {
    expect(starterBoq("OTHER", 100, 1)).toEqual([]);
    expect(starterBoq("VILLA", 0, 1)).toEqual([]);
    expect(starterBoq("VILLA", -5, 1)).toEqual([]);
    expect(starterBoq("VILLA", 100, 0)).toEqual([]);
    expect(starterBoq("VILLA", 100, 1.5)).toEqual([]);
    expect(starterBoq("VILLA", NaN, 1)).toEqual([]);
  });
});

describe("csv", () => {
  it("neutralises formulas and quotes commas", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(5)).toBe("5");
  });
  it("renders a row with blank cost when unpriced", () => {
    const out = boqCsv([
      { section: "S", description: "D", unit: "m2", ...line({ unitRate: null }) },
    ]);
    expect(out.split("\r\n")[1]).toBe("S,D,m2,100,5,105,,");
  });
});
