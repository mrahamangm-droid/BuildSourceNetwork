import { describe, expect, it } from "vitest";
import { applyMovement, toMilli } from "../src/server/stock-math";
import { autoActionFor, nextState, suggestProduct } from "../src/lib/order-stock";

describe("nextState", () => {
  it("allows the intended flow", () => {
    expect(nextState("NONE", "reserve")).toBe("RESERVED");
    expect(nextState("RELEASED", "reserve")).toBe("RESERVED");
    expect(nextState("RESERVED", "issue")).toBe("ISSUED");
    expect(nextState("RESERVED", "release")).toBe("RELEASED");
  });
  it("blocks double actions and reversing issued stock", () => {
    expect(nextState("RESERVED", "reserve")).toBeNull();
    expect(nextState("ISSUED", "reserve")).toBeNull();
    expect(nextState("ISSUED", "release")).toBeNull();
    expect(nextState("NONE", "issue")).toBeNull();
    expect(nextState("RELEASED", "issue")).toBeNull();
  });
});

describe("autoActionFor", () => {
  it("issues on dispatch, releases on cancel, otherwise nothing", () => {
    expect(autoActionFor("DISPATCHED")).toBe("issue");
    expect(autoActionFor("CANCELLED")).toBe("release");
    for (const s of ["CONFIRMED", "PREPARING", "DELIVERED", "COMPLETED"])
      expect(autoActionFor(s)).toBeNull();
  });
});

describe("suggestProduct", () => {
  const products = [
    { id: "a", name: "Portland Cement 50kg Bag", unitCode: "BAG" },
    { id: "b", name: "Rebar 12mm", unitCode: "TON" },
    { id: "c", name: "Portland Cement 25kg Bag", unitCode: "BAG" },
    { id: "d", name: "Cement", unitCode: "KG" },
  ];
  it("needs the same unit", () => {
    expect(suggestProduct({ name: "Cement", unitCode: "TON" }, products)).toBe("");
  });
  it("picks a clear best match", () => {
    expect(suggestProduct({ name: "Rebar 12mm", unitCode: "TON" }, products)).toBe("b");
    expect(suggestProduct({ name: "Portland cement 50kg", unitCode: "BAG" }, products)).toBe("a");
  });
  it("returns nothing when candidates tie", () => {
    expect(suggestProduct({ name: "Portland cement", unitCode: "BAG" }, products)).toBe("");
  });
  it("returns nothing for weak matches or empty names", () => {
    expect(suggestProduct({ name: "Steel angle bar", unitCode: "TON" }, products)).toBe("");
    expect(suggestProduct({ name: "the of", unitCode: "BAG" }, products)).toBe("");
  });
});

describe("issuing reserved stock (release, then issue)", () => {
  it("consumes the reservation and removes the goods", () => {
    const start = { onHand: toMilli(10), reserved: toMilli(4) };
    const released = applyMovement(start, "RELEASE", toMilli(4)).balance;
    const issued = applyMovement(released, "ISSUE", toMilli(4)).balance;
    expect(issued).toEqual({ onHand: toMilli(6), reserved: 0 });
  });
  it("cannot oversell stock reserved for other orders", () => {
    const start = { onHand: toMilli(10), reserved: toMilli(10) };
    const released = applyMovement(start, "RELEASE", toMilli(4)).balance; // reserved 6
    expect(applyMovement(released, "ISSUE", toMilli(4)).balance.onHand).toBe(toMilli(6));
    expect(() => applyMovement(released, "ISSUE", toMilli(5))).toThrow();
  });
});
