import { slugify } from "./slug";
import { MANUFACTURER_TEXT } from "./brands-data";

export type SeedManufacturer = { slug: string; name: string; country: string; brands: string[] };

/** Parses the compact manufacturer list. Throws on structure errors so a bad edit fails the tests. */
export function parseManufacturers(text: string): SeedManufacturer[] {
  const out: SeedManufacturer[] = [];
  for (const [i, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("M ")) {
      const [name, country] = line
        .slice(2)
        .split("|")
        .map((s) => s.trim());
      if (!name || !/^[A-Z]{2}$/.test(country ?? ""))
        throw new Error(`Manufacturer list line ${i + 1}: expected "M Name | CC"`);
      out.push({ slug: slugify(name), name, country, brands: [] });
    } else if (line.startsWith("B ")) {
      const cur = out[out.length - 1];
      if (!cur) throw new Error(`Manufacturer list line ${i + 1}: brands before a manufacturer`);
      const brands = line
        .slice(2)
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!brands.length) throw new Error(`Manufacturer list line ${i + 1}: empty brand line`);
      cur.brands.push(...brands);
    } else {
      throw new Error(`Manufacturer list line ${i + 1}: unknown line type`);
    }
  }
  return out;
}

export const MANUFACTURERS = parseManufacturers(MANUFACTURER_TEXT);
