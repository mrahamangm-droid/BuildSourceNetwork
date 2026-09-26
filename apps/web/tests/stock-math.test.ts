import { describe, expect, it } from "vitest";
import {
  applyMovement,
  available,
  isLow,
  statusFor,
  StockError,
  toMilli,
} from "@/server/stock-math";

const b = (onHand: number, reserved = 0) => ({
  onHand: toMilli(onHand),
  reserved: toMilli(reserved),
});

describe("stock math", () => {
  it("receipt adds to on-hand", () => {
    const r = applyMovement(b(10), "RECEIPT", toMilli(5));
    expect(r.balance.onHand).toBe(toMilli(15));
    expect(r.onHandDelta).toBe(toMilli(5));
  });
  it("issue cannot exceed available stock (reserved is protected)", () => {
    expect(() => applyMovement(b(10, 8), "ISSUE", toMilli(3))).toThrow(StockError);
    expect(applyMovement(b(10, 8), "ISSUE", toMilli(2)).balance.onHand).toBe(toMilli(8));
  });
  it("reserve only up to available, and release only up to reserved", () => {
    expect(() => applyMovement(b(10, 9), "RESERVE", toMilli(2))).toThrow(StockError);
    expect(applyMovement(b(10, 4), "RESERVE", toMilli(6)).balance.reserved).toBe(toMilli(10));
    expect(() => applyMovement(b(10, 4), "RELEASE", toMilli(5))).toThrow(StockError);
    expect(applyMovement(b(10, 4), "RELEASE", toMilli(4)).balance.reserved).toBe(0);
  });
  it("stock take sets on-hand, records the delta, and cannot go below reserved", () => {
    const r = applyMovement(b(10, 2), "ADJUSTMENT", toMilli(7));
    expect(r.balance.onHand).toBe(toMilli(7));
    expect(r.onHandDelta).toBe(toMilli(-3));
    expect(() => applyMovement(b(10, 5), "ADJUSTMENT", toMilli(4))).toThrow(StockError);
    expect(applyMovement(b(10, 0), "ADJUSTMENT", 0).balance.onHand).toBe(0);
  });
  it("rejects zero, negative and non-finite quantities for normal movements", () => {
    for (const q of [0, -1, NaN, Infinity])
      expect(() => applyMovement(b(10), "RECEIPT", q)).toThrow(StockError);
  });
  it("has no float drift on fractional quantities", () => {
    let bal = b(0);
    for (let i = 0; i < 10; i++) bal = applyMovement(bal, "RECEIPT", toMilli(0.1)).balance;
    expect(bal.onHand).toBe(toMilli(1));
  });
  it("invariant: 0 <= reserved <= onHand across a random sequence", () => {
    let bal = b(50);
    const kinds = ["RECEIPT", "ISSUE", "RESERVE", "RELEASE", "ADJUSTMENT"] as const;
    let seed = 42;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 2000; i++) {
      const k = kinds[Math.floor(rnd() * kinds.length)];
      try {
        bal = applyMovement(bal, k, toMilli(Math.round(rnd() * 20 * 1000) / 1000)).balance;
      } catch (e) {
        expect(e).toBeInstanceOf(StockError);
      }
      expect(bal.reserved).toBeGreaterThanOrEqual(0);
      expect(bal.onHand).toBeGreaterThanOrEqual(bal.reserved);
    }
  });
  it("derives marketplace status and low-stock flag", () => {
    expect(statusFor(0, 5)).toBe("OUT_OF_STOCK");
    expect(statusFor(5, 5)).toBe("LOW_STOCK");
    expect(statusFor(6, 5)).toBe("IN_STOCK");
    expect(statusFor(1, 0)).toBe("IN_STOCK");
    expect(isLow(b(10, 6), toMilli(5))).toBe(true);
    expect(available(b(10, 6))).toBe(toMilli(4));
  });
});
