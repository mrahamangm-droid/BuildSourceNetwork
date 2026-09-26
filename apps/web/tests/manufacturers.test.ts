import { describe, expect, it } from "vitest";
import {
  APPLICATIONS,
  COLORS,
  MANUFACTURERS,
  MATERIALS,
  parseManufacturers,
  slugify,
} from "@bmn/config";

describe("manufacturer and brand seed list", () => {
  it("is large, well formed and free of duplicate manufacturers", () => {
    expect(MANUFACTURERS.length).toBeGreaterThanOrEqual(150);
    const brands = MANUFACTURERS.flatMap((m) => m.brands);
    expect(brands.length).toBeGreaterThanOrEqual(350);
    const slugs = MANUFACTURERS.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const m of MANUFACTURERS) {
      expect(m.brands.length, m.name).toBeGreaterThan(0);
      expect(m.country).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("gives every brand slug to exactly one manufacturer", () => {
    const owner = new Map<string, string>();
    const dupes: string[] = [];
    for (const m of MANUFACTURERS)
      for (const b of m.brands) {
        const s = slugify(b);
        if (owner.has(s) && owner.get(s) !== m.slug)
          dupes.push(`${b} (${owner.get(s)} / ${m.slug})`);
        owner.set(s, m.slug);
      }
    expect(dupes).toEqual([]);
  });

  it("rejects malformed lists", () => {
    expect(() => parseManufacturers("B Orphan brand")).toThrow(/before a manufacturer/);
    expect(() => parseManufacturers("M Acme | UAE")).toThrow(/expected/);
    expect(() => parseManufacturers("M Acme | AE\nB ; ;")).toThrow(/empty brand/);
    expect(() => parseManufacturers("X nope")).toThrow(/unknown line/);
  });

  it("has rich attribute suggestion lists without duplicates", () => {
    for (const list of [MATERIALS, COLORS, APPLICATIONS]) {
      expect(list.length).toBeGreaterThan(30);
      expect(new Set(list.map((v) => v.toLowerCase())).size).toBe(list.length);
    }
  });
});
