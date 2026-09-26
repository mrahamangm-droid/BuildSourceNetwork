import { parseFlexibleNumber } from "./number";
import { FIELDS, type FieldKey } from "./fields";
import type { ColumnMap } from "./mapping";
import { closest } from "./suggest";
import { matchUnitCode, guessCategoryName } from "../boq-rfq";
import { parseStock } from "../product-import";

/** Lookup data resolved from the database once per job. */
export type Refs = {
  categories: { id: string; name: string; slug: string }[];
  subcategories: { id: string; categoryId: string; name: string; slug: string }[];
  types: { id: string; subcategoryId: string; name: string; slug: string }[];
  unitCodes: string[];
  unitNames?: { code: string; name: string }[];
};

/** Typed, normalised values for the fields that were present in the row. */
export type RowValues = {
  sku?: string;
  name?: string;
  categoryId?: string;
  subcategoryId?: string;
  productTypeId?: string;
  brandName?: string;
  manufacturerName?: string;
  unitCode?: string;
  price?: number;
  wholesalePrice?: number;
  contractorPrice?: number;
  minOrderQty?: number;
  stockStatus?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "ON_REQUEST";
  packageSize?: string;
  vatRatePercent?: number;
  city?: string;
  description?: string;
  material?: string;
  grade?: string;
  size?: string;
  dimensions?: string;
  color?: string;
  finish?: string;
  application?: string;
  countryOfOrigin?: string;
  specifications?: string;
  imageUrl?: string;
  deliveryAvailable?: boolean;
  isActive?: boolean;
};

export type RowIssue = { field: FieldKey; message: string; fix?: string };
export type RowResult = { values: RowValues; errors: RowIssue[]; warnings: RowIssue[] };

const clean = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

const lc = (s: string) => s.trim().toLowerCase();
const MAX_MONEY = 1e9;

export function parseYesNo(raw: string): boolean | null {
  const t = lc(raw);
  if (/^(y|yes|true|1|available|active|on|✓|نعم)$/.test(t)) return true;
  if (/^(n|no|false|0|unavailable|inactive|off|none|لا)$/.test(t)) return false;
  return null;
}

function normalizeSpecs(raw: string): string {
  // "Key: value; Key2: value2" or newline separated -> one pair per line, as the product form stores it.
  return raw
    .split(/\r?\n|;(?=\s*[^;:]+:)/)
    .map((l) => l.trim())
    .filter((l) => l.includes(":"))
    .join("\n");
}

const TEXT_LIMITS: Partial<Record<FieldKey, number>> = {
  sku: 60,
  name: 160,
  brand: 80,
  manufacturer: 80,
  packageSize: 80,
  city: 80,
  description: 4000,
  material: 80,
  grade: 80,
  size: 80,
  dimensions: 120,
  color: 60,
  finish: 60,
  application: 80,
  countryOfOrigin: 60,
  specifications: 3000,
  imageUrl: 500,
};

/**
 * Validates one row. `cells` are the raw strings of the row and `map` says which column holds which
 * field. Only fields that are mapped AND non-empty appear in `values`, so a price-only update never
 * touches other columns. Required-field checks for NEW products are separate (see missingForCreate).
 */
export function validateRow(cells: string[], map: ColumnMap, refs: Refs): RowResult {
  const values: RowValues = {};
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const get = (k: FieldKey) => {
    const i = map[k];
    return i === undefined ? "" : clean(cells[i] ?? "");
  };
  const err = (field: FieldKey, message: string, fix?: string) =>
    errors.push({ field, message, fix });
  const warn = (field: FieldKey, message: string, fix?: string) =>
    warnings.push({ field, message, fix });

  const text = (k: FieldKey, into: keyof RowValues) => {
    let v = get(k);
    if (!v) return;
    const max = TEXT_LIMITS[k];
    if (max && v.length > max) {
      warn(k, `${label(k)} was longer than ${max} characters and was shortened`);
      v = v.slice(0, max);
    }
    (values as Record<string, unknown>)[into] = v;
  };
  const label = (k: FieldKey) => FIELDS.find((f) => f.key === k)!.label;

  text("sku", "sku");
  text("name", "name");
  if (values.name !== undefined && values.name.length < 2)
    err("name", "Product name is too short", "Use at least 2 characters");

  // Numbers
  const num = (
    k: FieldKey,
    opts: { min?: number; max?: number; allowZero?: boolean; suffix?: boolean },
  ) => {
    const raw = get(k);
    if (!raw) return undefined;
    const r = parseFlexibleNumber(raw, { allowSuffix: opts.suffix });
    if (r == null) return undefined;
    if ("error" in r) {
      err(
        k,
        `${label(k)} “${raw.slice(0, 30)}” is not a valid number`,
        "Use digits only, for example 1250.50",
      );
      return undefined;
    }
    const n = r.value;
    if (n === 0 && !opts.allowZero) {
      err(k, `${label(k)} must be above 0`, "Enter a value above 0");
      return undefined;
    }
    if (n > (opts.max ?? MAX_MONEY)) {
      err(
        k,
        `${label(k)} is too large`,
        `Maximum is ${(opts.max ?? MAX_MONEY).toLocaleString("en")}`,
      );
      return undefined;
    }
    return n;
  };
  const price = num("price", {});
  if (price !== undefined) values.price = Math.round(price * 100) / 100;
  const wp = num("wholesalePrice", {});
  if (wp !== undefined) values.wholesalePrice = Math.round(wp * 100) / 100;
  const cp = num("contractorPrice", {});
  if (cp !== undefined) values.contractorPrice = Math.round(cp * 100) / 100;
  const moq = num("minOrderQty", { suffix: true });
  if (moq !== undefined) values.minOrderQty = Math.round(moq * 1000) / 1000;
  const vat = num("vatRatePercent", { max: 100, allowZero: true });
  if (vat !== undefined) values.vatRatePercent = vat;
  const qty = num("stockQty", { allowZero: true, suffix: true });

  // Tier prices should not exceed the retail price, but that is the supplier's call: warn only.
  if (values.price !== undefined) {
    if (values.wholesalePrice !== undefined && values.wholesalePrice > values.price)
      warn("wholesalePrice", "Wholesale price is higher than the retail price");
    if (values.contractorPrice !== undefined && values.contractorPrice > values.price)
      warn("contractorPrice", "Contractor price is higher than the retail price");
  }

  // Availability: explicit text wins, otherwise derived from the quantity.
  const stockRaw = get("stockStatus");
  if (stockRaw) {
    const s = parseStock(stockRaw);
    if (!s)
      err(
        "stockStatus",
        `Unknown availability “${stockRaw.slice(0, 30)}”`,
        "Use In stock, Low stock, Out of stock or On request",
      );
    else values.stockStatus = s;
  } else if (qty !== undefined) {
    values.stockStatus = qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
  }

  // Unit
  const unitRaw = get("unit");
  if (unitRaw) {
    const byAlias = matchUnitCode(unitRaw, refs.unitCodes);
    const upper = unitRaw.toUpperCase();
    const byName = refs.unitNames?.find((u) => lc(u.name) === lc(unitRaw))?.code;
    const code = byAlias || (refs.unitCodes.includes(upper) ? upper : "") || byName || "";
    if (code) values.unitCode = code;
    else {
      const sug = closest(unitRaw, [
        ...refs.unitCodes,
        ...(refs.unitNames?.map((u) => u.name) ?? []),
      ]);
      err(
        "unit",
        `Unknown unit “${unitRaw.slice(0, 20)}”`,
        sug ? `Did you mean ${sug}?` : "Pick a unit from the template drop-down",
      );
    }
  }

  // Taxonomy: category -> subcategory -> product type, each checked against its parent.
  const catRaw = get("category");
  const subRaw = get("subcategory");
  const typeRaw = get("productType");
  let catId: string | undefined;
  if (catRaw) {
    const t = lc(catRaw);
    const hit = refs.categories.find((c) => lc(c.name) === t || c.slug === t);
    if (hit) catId = hit.id;
    else {
      const sug = closest(
        catRaw,
        refs.categories.map((c) => c.name),
      );
      err(
        "category",
        `Unknown category “${catRaw.slice(0, 40)}”`,
        sug ? `Did you mean ${sug}?` : "Pick a category from the template drop-down",
      );
    }
  }
  let subId: string | undefined;
  if (subRaw) {
    const t = lc(subRaw);
    const pool = catId
      ? refs.subcategories.filter((s) => s.categoryId === catId)
      : refs.subcategories;
    const hits = pool.filter((s) => lc(s.name) === t || s.slug === t);
    if (hits.length === 1) {
      subId = hits[0]!.id;
      if (!catRaw) {
        catId = hits[0]!.categoryId;
        warn("category", "Category was taken from the subcategory");
      }
    } else if (hits.length > 1)
      err(
        "subcategory",
        `“${subRaw.slice(0, 40)}” exists under several categories`,
        "Fill in the Category column too",
      );
    else if (catId || !catRaw) {
      const sug = closest(
        subRaw,
        pool.map((s) => s.name),
      );
      err(
        "subcategory",
        `Subcategory “${subRaw.slice(0, 40)}” not found${catRaw ? ` under ${catRaw}` : ""}`,
        sug ? `Did you mean ${sug}?` : "Pick a subcategory from the drop-down",
      );
    }
  }
  let typeId: string | undefined;
  if (typeRaw) {
    if (!subId) {
      if (!subRaw)
        err("productType", "Product type needs a subcategory", "Fill in the Subcategory column");
    } else {
      const t = lc(typeRaw);
      const hit = refs.types.find(
        (x) => x.subcategoryId === subId && (lc(x.name) === t || x.slug === t),
      );
      if (hit) typeId = hit.id;
      else {
        const sug = closest(
          typeRaw,
          refs.types.filter((x) => x.subcategoryId === subId).map((x) => x.name),
        );
        err(
          "productType",
          `Product type “${typeRaw.slice(0, 40)}” not found under this subcategory`,
          sug ? `Did you mean ${sug}?` : "Pick a product type from the drop-down",
        );
      }
    }
  }
  if (!catId && !catRaw && !map.sku && values.name) {
    // Last resort for messy lists: a confident keyword guess, always flagged.
    const g = guessCategoryName(values.name);
    const hit = g ? refs.categories.find((c) => lc(c.name) === lc(g)) : undefined;
    if (hit) {
      catId = hit.id;
      warn(
        "category",
        `Category guessed from the name: ${hit.name}`,
        "Check it or fill in the Category column",
      );
    }
  }
  if (catId) values.categoryId = catId;
  if (subId) values.subcategoryId = subId;
  if (typeId) values.productTypeId = typeId;

  text("brand", "brandName");
  text("manufacturer", "manufacturerName");
  text("packageSize", "packageSize");
  text("city", "city");
  text("description", "description");
  text("material", "material");
  text("grade", "grade");
  text("size", "size");
  text("dimensions", "dimensions");
  text("color", "color");
  text("finish", "finish");
  text("application", "application");
  text("countryOfOrigin", "countryOfOrigin");
  const specs = get("specifications");
  if (specs) {
    const s = normalizeSpecs(cells[map.specifications!] ?? "");
    if (s) values.specifications = s.slice(0, 3000);
    else warn("specifications", "Specifications need “Key: value” pairs and were ignored");
  }
  const img = get("imageUrl");
  if (img) {
    if (/^https?:\/\/\S+$/i.test(img) && img.length <= 500) values.imageUrl = img;
    else
      err(
        "imageUrl",
        "Image URL must start with http:// or https://",
        "Use a full link, or add images later in the bulk image step",
      );
  }
  for (const [k, into] of [
    ["delivery", "deliveryAvailable"],
    ["active", "isActive"],
  ] as const) {
    const raw = get(k);
    if (!raw) continue;
    const b = parseYesNo(raw);
    if (b === null) err(k, `${label(k)} “${raw.slice(0, 20)}” is not Yes or No`, "Use Yes or No");
    else values[into] = b;
  }
  return { values, errors, warnings };
}

/** Fields a brand-new product cannot be created without. */
export function missingForCreate(v: RowValues): RowIssue[] {
  const out: RowIssue[] = [];
  const need = (ok: boolean, field: FieldKey, msg: string, fix: string) => {
    if (!ok) out.push({ field, message: msg, fix });
  };
  need(!!v.name, "name", "Product name is missing", "Fill in the Product Name column");
  need(!!v.categoryId, "category", "Category is missing", "Pick a category from the drop-down");
  need(!!v.unitCode, "unit", "Unit is missing", "Pick a unit such as BAG, TON or M2");
  need(v.price !== undefined, "price", "Price is missing", "Enter the price per unit");
  return out;
}

/** Stable key used to spot the same product twice in one file (and to match existing products). */
export function dedupeKey(v: RowValues): string {
  if (v.sku) return `sku:${lc(v.sku)}`;
  return `n:${lc(v.name ?? "")}|${lc(v.brandName ?? "")}|${lc(v.unitCode ?? "")}|${lc(v.size ?? "")}`;
}
