import { describe, expect, it } from "vitest";
import { parseBoqList, parseNumber, splitRow } from "@/lib/boq-import";

describe("parseNumber", () => {
  it("handles thousands separators and decimal commas", () => {
    expect(parseNumber("1,200")).toBe(1200);
    expect(parseNumber("1.200,5")).toBe(1200.5);
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber("12.5")).toBe(12.5);
    expect(parseNumber("abc")).toBeNaN();
  });
});
describe("splitRow", () => {
  it("supports quoted cells with commas and escaped quotes", () => {
    expect(splitRow('"Cement, OPC",200,"bag ""50kg"""', ",")).toEqual([
      "Cement, OPC",
      "200",
      'bag "50kg"',
    ]);
  });
});
describe("parseBoqList", () => {
  it("reads a CSV with a header in any column order", () => {
    const r = parseBoqList(
      "Unit,Item,Qty,Section,Waste %\nbag,Cement 42.5N,200,Structure,5\nton,Rebar 12mm,3.5,Structure,",
    );
    expect(r.lines).toEqual([
      {
        section: "Structure",
        description: "Cement 42.5N",
        unit: "bag",
        quantity: 200,
        wastePercent: 5,
      },
      {
        section: "Structure",
        description: "Rebar 12mm",
        unit: "ton",
        quantity: 3.5,
        wastePercent: 0,
      },
    ]);
    expect(r.skipped).toEqual([]);
  });
  it("reads headerless tab-separated rows and section headings", () => {
    const r = parseBoqList("Finishes\t\t\nFloor tiles 60x60\t120\tm2\nPaint\t40\tltr");
    expect(r.lines.map((l) => [l.section, l.description, l.quantity, l.unit])).toEqual([
      ["Finishes", "Floor tiles 60x60", 120, "m2"],
      ["Finishes", "Paint", 40, "ltr"],
    ]);
  });
  it("understands free-text lists in both orders and reports what it cannot read", () => {
    const r = parseBoqList(
      "Masonry:\nBlocks 200mm - 1,500 pcs\n300 bags cement\nsee drawings for the rest",
    );
    expect(r.lines.map((l) => [l.description, l.quantity, l.unit, l.section])).toEqual([
      ["Blocks 200mm", 1500, "pcs", "Masonry"],
      ["cement", 300, "bags", "Masonry"],
    ]);
    expect(r.skipped).toEqual(["see drawings for the rest"]);
  });
  it("does not treat a size like 42.5N as a quantity", () => {
    expect(parseBoqList("Cement 42.5N").lines).toEqual([]);
  });
  it("drops duplicates and rejects non-positive or absurd quantities", () => {
    const r = parseBoqList("Item,Qty,Unit\nSand,10,ton\nSand,10,ton\nGravel,0,ton\nStone,1e12,ton");
    expect(r.lines).toHaveLength(1);
    expect(r.skipped).toHaveLength(2);
  });
  it("caps very long lists", () => {
    const rows = Array.from({ length: 250 }, (_, i) => `Item ${i},1,pcs`).join("\n");
    const r = parseBoqList(`Item,Qty,Unit\n${rows}`);
    expect(r.lines).toHaveLength(200);
    expect(r.truncated).toBe(true);
  });
});
