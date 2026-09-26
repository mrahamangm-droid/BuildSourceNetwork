/**
 * Bulk product import for suppliers and stores. Reads a CSV/TSV (or pasted rows from Excel) with a
 * header row and turns each row into a validated product draft. Deterministic and defensive: values
 * are trimmed and clamped, unknown categories or units are reported instead of guessed, and one bad
 * row never blocks the rest. Nothing here touches the database; the caller resolves names to ids.
 */
import { z } from "zod";
import { splitRow, parseNumber } from "./boq-import";
import { guessCategoryName, matchUnitCode } from "./boq-rfq";

export const PRODUCT_IMPORT_MAX_ROWS = 100;
export const PRODUCT_IMPORT_MAX_CHARS = 200_000;

export const STOCK_STATUSES = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "ON_REQUEST"] as const;
export type StockStatusValue = (typeof STOCK_STATUSES)[number];

export type ProductImportRow = {
  name: string;
  sku: string;
  categoryName: string;
  brandName: string;
  unitCode: string;
  price: number;
  wholesalePrice: number | null;
  contractorPrice: number | null;
  minOrderQty: number;
  stockStatus: StockStatusValue;
  packageSize: string;
  city: string;
  description: string;
  vatRatePercent: number;
};

export type ProductImportIssue = { row: number; name: string; message: string };
export type ProductImportResult = {
  rows: ProductImportRow[];
  issues: ProductImportIssue[];
  truncated: boolean;
};
export type ProductImportRefs = { categories: string[]; unitCodes: string[] };

/** Re-validation on the server for rows that came back from the browser. */
export const productImportRowSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sku: z.string().trim().max(60).default(""),
  categoryName: z.string().trim().min(1).max(80),
  brandName: z.string().trim().max(80).default(""),
  unitCode: z.string().trim().min(1).max(16),
  price: z.coerce.number().finite().gt(0).max(1e9),
  wholesalePrice: z.coerce.number().finite().gt(0).max(1e9).nullable().default(null),
  contractorPrice: z.coerce.number().finite().gt(0).max(1e9).nullable().default(null),
  minOrderQty: z.coerce.number().finite().gt(0).max(1e9).default(1),
  stockStatus: z.enum(STOCK_STATUSES).default("IN_STOCK"),
  packageSize: z.string().trim().max(80).default(""),
  city: z.string().trim().max(80).default(""),
  description: z.string().trim().max(4000).default(""),
  vatRatePercent: z.coerce.number().finite().min(0).max(100).default(5),
});
export const productImportRowsSchema = z
  .array(productImportRowSchema)
  .min(1, "Select at least one product")
  .max(PRODUCT_IMPORT_MAX_ROWS);

const clean = (s: string) =>
  s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const HEAD = {
  name: /^(name|product|item|material|title)/i,
  price: /^(price|unit price|retail|rate|selling price)/i,
  unit: /^(unit$|unit of|uom|sold per|per$)/i,
  category: /^(category|type|group)/i,
  brand: /^(brand|make|manufacturer)/i,
  sku: /^(sku|code|item code|product code|part)/i,
  wholesale: /^(wholesale|bulk)/i,
  contractor: /^(contractor|trade)/i,
  minQty: /^(min|moq|minimum)/i,
  stock: /^(stock|availability|status)/i,
  pack: /^(pack|package|size)/i,
  city: /^(city|location|emirate)/i,
  desc: /^(description|details|notes|spec|about)/i,
  vat: /^(vat|tax)/i,
} as const;
type Col = keyof typeof HEAD;

/** Which column index holds which field; null unless the two required columns are present. */
export function mapProductHeader(cells: string[]): Record<Col, number> | null {
  const idx = Object.fromEntries((Object.keys(HEAD) as Col[]).map((k) => [k, -1])) as Record<
    Col,
    number
  >;
  cells.forEach((raw, i) => {
    const c = raw.trim();
    // Most specific headings first so "Wholesale price" is not read as the retail price.
    const order: Col[] = [
      "wholesale",
      "contractor",
      "minQty",
      "sku",
      "brand",
      "category",
      "unit",
      "price",
      "stock",
      "pack",
      "city",
      "vat",
      "name",
      "desc",
    ];
    for (const k of order)
      if (idx[k] === -1 && HEAD[k].test(c)) {
        idx[k] = i;
        break;
      }
  });
  // A sheet with only a "Description" column: treat it as the product name.
  if (idx.name === -1 && idx.desc >= 0) {
    idx.name = idx.desc;
    idx.desc = -1;
  }
  return idx.name >= 0 && idx.price >= 0 ? idx : null;
}

function detectDelimiter(lines: string[]): string | null {
  const sample = lines.slice(0, 10);
  for (const d of ["\t", ";", ","]) {
    const counts = sample.map((l) => splitRow(l, d).length);
    if (counts.filter((c) => c >= 2).length >= Math.max(1, Math.ceil(sample.length / 2))) return d;
  }
  return null;
}

export function parseStock(raw: string): StockStatusValue | null {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
  if (!t) return "IN_STOCK";
  if (/^(in stock|available|yes|y|instock)$/.test(t)) return "IN_STOCK";
  if (/^(low|low stock|limited)$/.test(t)) return "LOW_STOCK";
  if (/^(out|out of stock|no|n|unavailable|sold out)$/.test(t)) return "OUT_OF_STOCK";
  if (/^(on request|request|order|made to order|ask)$/.test(t)) return "ON_REQUEST";
  return null;
}

function resolveUnit(raw: string, known: string[]): string {
  const t = raw.trim();
  if (!t) return "";
  const byAlias = matchUnitCode(t, known);
  if (byAlias) return byAlias;
  const upper = t.toUpperCase();
  return known.includes(upper) ? upper : "";
}

function resolveCategory(raw: string, name: string, known: string[]): string {
  const find = (n: string) => known.find((k) => k.toLowerCase() === n.trim().toLowerCase()) ?? "";
  const direct = raw.trim() ? find(raw) : "";
  if (direct) return direct;
  if (raw.trim()) {
    // Tolerate "Cements" / "Steel & rebar": accept a unique prefix or containment match.
    const t = raw.trim().toLowerCase();
    const hits = known.filter(
      (k) => k.toLowerCase().startsWith(t) || t.startsWith(k.toLowerCase().replace(/s$/, "")),
    );
    if (hits.length === 1) return hits[0]!;
    return "";
  }
  return find(guessCategoryName(name));
}

export function parseProductList(text: string, refs: ProductImportRefs): ProductImportResult {
  const all = text
    .slice(0, PRODUCT_IMPORT_MAX_CHARS)
    .split(/\r?\n/)
    .map((l) => l.replace(/^﻿/, ""));
  const rows: ProductImportRow[] = [];
  const issues: ProductImportIssue[] = [];
  let truncated = false;

  const lines = all.filter((l) => l.trim());
  const delim = detectDelimiter(lines);
  const head = delim ? mapProductHeader(splitRow(lines[0] ?? "", delim)) : null;
  if (!delim || !head) return { rows, issues, truncated };

  const seenSku = new Set<string>();
  const seenName = new Set<string>();
  lines.slice(1).forEach((line, n) => {
    const rowNo = n + 2; // 1-based including the header
    const c = splitRow(line, delim);
    const get = (k: Col) => (head[k] >= 0 ? clean(c[head[k]] ?? "") : "");
    const name = get("name");
    const bad = (message: string) => issues.push({ row: rowNo, name: name.slice(0, 60), message });

    if (!name) return bad("Missing product name");
    if (name.length < 2) return bad("Product name is too short");
    const price = parseNumber(get("price"));
    if (!Number.isFinite(price) || price <= 0) return bad("Price must be a number above 0");
    if (price > 1e9) return bad("Price is too large");

    const unitCode = resolveUnit(get("unit"), refs.unitCodes);
    if (!unitCode)
      return bad(
        get("unit") ? `Unknown unit “${get("unit")}”` : "Missing unit (e.g. bag, ton, m2)",
      );
    const categoryName = resolveCategory(get("category"), name, refs.categories);
    if (!categoryName)
      return bad(
        get("category")
          ? `Unknown category “${get("category")}”`
          : "Missing category for this item",
      );
    const stock = parseStock(get("stock"));
    if (!stock) return bad(`Unknown stock value “${get("stock")}”`);

    const opt = (k: Col) => {
      const v = get(k);
      if (!v) return { ok: true as const, value: null };
      const x = parseNumber(v);
      return Number.isFinite(x) && x > 0 && x <= 1e9
        ? { ok: true as const, value: x }
        : { ok: false as const, value: null };
    };
    const wholesale = opt("wholesale");
    const contractor = opt("contractor");
    const minQty = opt("minQty");
    if (!wholesale.ok) return bad("Wholesale price is not a valid number");
    if (!contractor.ok) return bad("Contractor price is not a valid number");
    if (!minQty.ok) return bad("Minimum order quantity is not a valid number");
    const vatRaw = get("vat");
    const vat = vatRaw ? parseNumber(vatRaw.replace(/%$/, "")) : 5;
    if (!Number.isFinite(vat) || vat < 0 || vat > 100)
      return bad("VAT % must be between 0 and 100");

    const sku = get("sku").slice(0, 60);
    if (sku) {
      if (seenSku.has(sku.toLowerCase())) return bad(`Duplicate SKU “${sku}” in this file`);
      seenSku.add(sku.toLowerCase());
    } else {
      const key = `${name}|${get("brand")}|${unitCode}`.toLowerCase();
      if (seenName.has(key)) return bad("Duplicate of an earlier row");
      seenName.add(key);
    }
    if (rows.length >= PRODUCT_IMPORT_MAX_ROWS) {
      truncated = true;
      return;
    }
    rows.push({
      name: name.slice(0, 160),
      sku,
      categoryName,
      brandName: get("brand").slice(0, 80),
      unitCode,
      price: Math.round(price * 100) / 100,
      wholesalePrice: wholesale.value === null ? null : Math.round(wholesale.value * 100) / 100,
      contractorPrice: contractor.value === null ? null : Math.round(contractor.value * 100) / 100,
      minOrderQty: minQty.value ?? 1,
      stockStatus: stock,
      packageSize: get("pack").slice(0, 80),
      city: get("city").slice(0, 80),
      description: get("desc").slice(0, 4000),
      vatRatePercent: vat,
    });
  });
  return { rows, issues: issues.slice(0, 50), truncated };
}
