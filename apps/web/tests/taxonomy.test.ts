import { describe, expect, it } from "vitest";
import { CATEGORIES, TAXONOMY, parseTaxonomy, slugify, taxonomyCounts } from "@bmn/config";

describe("taxonomy data", () => {
  it("is a large, well-formed tree", () => {
    const c = taxonomyCounts();
    expect(c.departments).toBeGreaterThanOrEqual(15);
    expect(c.categories).toBeGreaterThanOrEqual(75);
    expect(c.subcategories).toBeGreaterThanOrEqual(280);
    expect(c.types).toBeGreaterThanOrEqual(1500);
    for (const d of TAXONOMY) {
      expect(d.categories.length).toBeGreaterThan(0);
      for (const cat of d.categories) {
        expect(cat.subcategories.length).toBeGreaterThan(0);
        for (const s of cat.subcategories) expect(s.types.length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every original category, under its original name", () => {
    const names = new Map(TAXONOMY.flatMap((d) => d.categories).map((c) => [c.slug, c.name]));
    for (const name of CATEGORIES) expect(names.get(slugify(name))).toBe(name);
  });

  it("has unique category slugs across departments", () => {
    const slugs = TAXONOMY.flatMap((d) => d.categories.map((c) => c.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("covers the whole build-to-maintain journey", () => {
    const depts = TAXONOMY.map((d) => d.name)
      .join(" | ")
      .toLowerCase();
    for (const word of [
      "earthworks",
      "concrete",
      "steel",
      "plumbing",
      "electrical",
      "roofing",
      "doors",
      "flooring",
      "kitchens",
      "furniture",
      "landscaping",
      "maintenance",
      "industrial",
    ])
      expect(depts).toContain(word);
  });
});

describe("parseTaxonomy", () => {
  it("parses departments, categories, subcategories and types", () => {
    const t = parseTaxonomy("D Dept One\nC Cat A\nS Sub X | One; Two\nS Sub Y\n");
    expect(t).toEqual([
      {
        slug: "dept-one",
        name: "Dept One",
        categories: [
          {
            slug: "cat-a",
            name: "Cat A",
            subcategories: [
              {
                slug: "sub-x",
                name: "Sub X",
                types: [
                  { slug: "one", name: "One" },
                  { slug: "two", name: "Two" },
                ],
              },
              { slug: "sub-y", name: "Sub Y", types: [] },
            ],
          },
        ],
      },
    ]);
  });
  it("rejects structure errors and duplicates", () => {
    expect(() => parseTaxonomy("C Cat")).toThrow(/before department/);
    expect(() => parseTaxonomy("D D\nS Sub")).toThrow(/before category/);
    expect(() => parseTaxonomy("D D\nC A\nC A")).toThrow(/duplicate category/);
    expect(() => parseTaxonomy("D D\nC A\nS S | x; X")).toThrow(/duplicate product type/);
    expect(() => parseTaxonomy("D D\nC A\nS S\nS s")).toThrow(/duplicate subcategory/);
    expect(() => parseTaxonomy("hello")).toThrow(/unrecognised/);
  });
});
