import { describe, expect, it } from "vitest";
import {
  normalizeForDuplicate,
  ratingBreakdown,
  roundRating,
  screenReviewText,
} from "../src/lib/reviews";

describe("screenReviewText", () => {
  it("accepts an ordinary review", () => {
    expect(screenReviewText("Great cement", "Delivered on time, bags were intact.")).toBeNull();
    expect(screenReviewText("", null, undefined)).toBeNull();
  });
  it("rejects links, emails, phone numbers, keyboard mashing and shouting", () => {
    expect(screenReviewText("see https://shop.example/deal")).toMatch(/links/);
    expect(screenReviewText("visit www.bestcement.com")).toMatch(/links/);
    expect(screenReviewText("cheaper at bestcement.ae")).toMatch(/links/);
    expect(screenReviewText("mail me at bob@example.org")).toMatch(/email/);
    expect(screenReviewText("call +971 50 123 4567 now")).toMatch(/phone/);
    expect(screenReviewText("aaaaaaaaaaaa")).toMatch(/repeated/);
    expect(screenReviewText("THIS PRODUCT IS ABSOLUTELY TERRIBLE AND I HATE IT")).toMatch(
      /capitals/,
    );
  });
  it("does not flag measurements or short capitals", () => {
    expect(screenReviewText("50 kg bag, grade 42.5, OPC, 12 mm rebar")).toBeNull();
    expect(screenReviewText("Good value. 10/10")).toBeNull();
  });
});

describe("duplicate detection and rating maths", () => {
  it("normalises punctuation, case and spacing", () => {
    expect(normalizeForDuplicate("  Great   Cement!! ")).toBe(
      normalizeForDuplicate("great cement"),
    );
    expect(normalizeForDuplicate(null)).toBe("");
  });
  it("builds a breakdown that adds up", () => {
    const b = ratingBreakdown({ 5: 6, 4: 3, 1: 1 });
    expect(b.count).toBe(10);
    expect(b.average).toBe(4.3);
    expect(b.rows.map((r) => r.stars)).toEqual([5, 4, 3, 2, 1]);
    expect(b.rows.find((r) => r.stars === 5)?.percent).toBe(60);
    expect(b.rows.find((r) => r.stars === 2)?.count).toBe(0);
    expect(ratingBreakdown({})).toEqual({
      count: 0,
      average: null,
      rows: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0, percent: 0 })),
    });
  });
  it("rounds averages to two decimals", () => {
    expect(roundRating(4.333333)).toBe(4.33);
    expect(roundRating(null)).toBeNull();
  });
});
