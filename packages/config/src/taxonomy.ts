import { TAXONOMY_TEXT } from "./taxonomy-data";
import { slugify } from "./slug";

export type TaxonomyProductType = { slug: string; name: string };
export type TaxonomySubcategory = { slug: string; name: string; types: TaxonomyProductType[] };
export type TaxonomyCategory = { slug: string; name: string; subcategories: TaxonomySubcategory[] };
export type TaxonomyDepartment = { slug: string; name: string; categories: TaxonomyCategory[] };

/** Parses the compact taxonomy text into a tree. Throws on malformed input or duplicate slugs. */
export function parseTaxonomy(text: string): TaxonomyDepartment[] {
  const departments: TaxonomyDepartment[] = [];
  let dept: TaxonomyDepartment | undefined;
  let cat: TaxonomyCategory | undefined;
  const seenCat = new Set<string>();
  const seenDept = new Set<string>();

  for (const [i, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    if (!line) continue;
    const at = `taxonomy line ${i + 1}`;
    const kind = line.slice(0, 2);
    const rest = line.slice(2).trim();
    if (kind === "D ") {
      const slug = slugify(rest);
      if (!slug || seenDept.has(slug)) throw new Error(`${at}: bad or duplicate department`);
      seenDept.add(slug);
      dept = { slug, name: rest, categories: [] };
      departments.push(dept);
      cat = undefined;
    } else if (kind === "C ") {
      if (!dept) throw new Error(`${at}: category before department`);
      const slug = slugify(rest);
      if (!slug || seenCat.has(slug)) throw new Error(`${at}: bad or duplicate category "${rest}"`);
      seenCat.add(slug);
      cat = { slug, name: rest, subcategories: [] };
      dept.categories.push(cat);
    } else if (kind === "S ") {
      if (!cat) throw new Error(`${at}: subcategory before category`);
      const [name, list = ""] = rest.split("|").map((s) => s.trim());
      const slug = slugify(name ?? "");
      if (!name || !slug || cat.subcategories.some((s) => s.slug === slug))
        throw new Error(`${at}: bad or duplicate subcategory "${name}"`);
      const types: TaxonomyProductType[] = [];
      for (const t of list
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)) {
        const ts = slugify(t);
        if (!ts || types.some((x) => x.slug === ts))
          throw new Error(`${at}: bad or duplicate product type "${t}"`);
        types.push({ slug: ts, name: t });
      }
      cat.subcategories.push({ slug, name, types });
    } else {
      throw new Error(`${at}: unrecognised line`);
    }
  }
  return departments;
}

export const TAXONOMY: TaxonomyDepartment[] = parseTaxonomy(TAXONOMY_TEXT);

export function taxonomyCounts(tree: TaxonomyDepartment[] = TAXONOMY) {
  let categories = 0;
  let subcategories = 0;
  let types = 0;
  for (const d of tree)
    for (const c of d.categories) {
      categories += 1;
      for (const s of c.subcategories) {
        subcategories += 1;
        types += s.types.length;
      }
    }
  return { departments: tree.length, categories, subcategories, types };
}
