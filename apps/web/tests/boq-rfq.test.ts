import { describe, expect, it } from "vitest";
import { boqLineToRfqItem, guessCategoryName, matchUnitCode } from "../src/lib/boq-rfq";

describe("matchUnitCode", () => {
  it("maps common spellings", () => {
    expect(matchUnitCode("m2")).toBe("SQM");
    expect(matchUnitCode(" M3 ")).toBe("CBM");
    expect(matchUnitCode("Tonnes")).toBe("TON");
    expect(matchUnitCode("nos")).toBe("PIECE");
  });
  it("returns empty for unknown units or codes missing from the database", () => {
    expect(matchUnitCode("furlong")).toBe("");
    expect(matchUnitCode("m2", ["KG"])).toBe("");
  });
});

describe("guessCategoryName", () => {
  it("matches whole words only", () => {
    expect(guessCategoryName("Reinforcement steel")).toBe("Steel");
    expect(guessCategoryName("Concrete blockwork")).toBe("Blocks");
    expect(guessCategoryName("Sandwich panel")).toBe("");
    expect(guessCategoryName("Floor tiling")).toBe("Tiles");
  });
  it("leaves works items uncategorised", () => {
    expect(guessCategoryName("Excavation")).toBe("");
    expect(guessCategoryName("Formwork")).toBe("");
    expect(guessCategoryName("Reinforced concrete (footings, columns, slabs)")).toBe("");
  });
});

describe("boqLineToRfqItem", () => {
  const env = {
    projectName: "Villa A",
    categories: [
      { id: "c1", name: "Steel" },
      { id: "c2", name: "Tiles" },
    ],
    unitCodes: ["KG", "SQM"],
  };
  it("uses the order quantity including waste and records where it came from", () => {
    const i = boqLineToRfqItem(
      { section: "Structure", description: "Reinforcement steel", unit: "kg", quantity: 1000, wastePercent: 5 },
      env,
    );
    expect(i).toMatchObject({ categoryId: "c1", quantity: "1050", unitCode: "KG", productId: "" });
    expect(i.specification).toBe('From project "Villa A", Structure, includes 5% waste');
  });
  it("leaves category and unit blank when it cannot tell", () => {
    const i = boqLineToRfqItem(
      { section: "Substructure", description: "Excavation", unit: "m3", quantity: 10, wastePercent: 0 },
      env,
    );
    expect(i.categoryId).toBe("");
    expect(i.unitCode).toBe(""); // CBM is not in this environment's unit list
    expect(i.specification).toBe('From project "Villa A", Substructure');
  });
});
