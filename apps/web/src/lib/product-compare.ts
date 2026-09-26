/** Product comparison: pure helpers for reading the id list and shaping the comparison table. */

export const COMPARE_MAX = 4;

/** Ids from `?ids=a,b,c`: trimmed, de-duplicated, limited to COMPARE_MAX, order kept. */
export function parseCompareIds(raw: string | string[] | undefined): string[] {
  const s = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const out: string[] = [];
  for (const part of s.split(",")) {
    const id = part.trim();
    if (/^[A-Za-z0-9_-]{8,40}$/.test(id) && !out.includes(id)) out.push(id);
    if (out.length === COMPARE_MAX) break;
  }
  return out;
}

export type CompareProduct = {
  id: string;
  name: string;
  price: number;
  currency: string;
  unit: string;
  minOrderQty: number;
  stockStatus: string;
  ratingAvg: number | null;
  ratingCount: number;
  breaks: { minQty: number; price: number }[];
  fields: Record<string, string | null>;
  specs: Record<string, string>;
};

export type CompareRow = {
  key: string;
  label: string;
  values: (string | null)[];
  /** True when the products do not all show the same value. */
  differs: boolean;
  /** Index of the product that wins on this row (lowest price, highest rating), if meaningful. */
  best: number | null;
};

const FIELD_LABELS: [string, string][] = [
  ["category", "Category"],
  ["brand", "Brand"],
  ["manufacturer", "Manufacturer"],
  ["packageSize", "Package"],
  ["material", "Material"],
  ["grade", "Grade / class"],
  ["size", "Size"],
  ["dimensions", "Dimensions"],
  ["color", "Colour"],
  ["finish", "Finish"],
  ["application", "Application"],
  ["countryOfOrigin", "Country of origin"],
  ["supplier", "Sold by"],
  ["city", "Location"],
  ["delivery", "Delivery"],
];

const norm = (v: string | null) => (v ?? "").trim().toLowerCase();
const differs = (vals: (string | null)[]) => new Set(vals.map(norm)).size > 1;

function bestIndex(nums: (number | null)[], mode: "min" | "max"): number | null {
  const valid = nums
    .map((n, i) => [n, i] as const)
    .filter((x): x is [number, number] => x[0] != null);
  if (valid.length < 2) return null;
  const target =
    mode === "min" ? Math.min(...valid.map((v) => v[0])) : Math.max(...valid.map((v) => v[0]));
  const winners = valid.filter((v) => v[0] === target);
  return winners.length === 1 ? winners[0]![1] : null; // ties have no winner
}

const STOCK: Record<string, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  ON_REQUEST: "On request",
};

export function buildCompareRows(
  products: CompareProduct[],
  fmtMoney: (n: number, currency: string) => string,
): CompareRow[] {
  const rows: CompareRow[] = [];
  const sameBasis =
    new Set(products.map((p) => `${p.currency}|${p.unit}`)).size === 1 && products.length > 1;

  const prices = products.map((p) => fmtMoney(p.price, p.currency));
  rows.push({
    key: "price",
    label: "Price",
    values: products.map((p, i) => `${prices[i]} / ${p.unit}`),
    differs: differs(prices),
    // Only rank prices when they are per the same unit and currency; otherwise it would mislead.
    best: sameBasis
      ? bestIndex(
          products.map((p) => p.price),
          "min",
        )
      : null,
  });
  const brk = products.map((p) =>
    p.breaks.length
      ? p.breaks.map((b) => `${b.minQty}+ : ${fmtMoney(b.price, p.currency)}`).join("\n")
      : null,
  );
  if (brk.some(Boolean))
    rows.push({
      key: "breaks",
      label: "Volume pricing",
      values: brk,
      differs: differs(brk),
      best: null,
    });

  const moq = products.map((p) => `${p.minOrderQty} ${p.unit}`);
  rows.push({
    key: "moq",
    label: "Minimum order",
    values: moq,
    differs: differs(moq),
    best: sameBasis
      ? bestIndex(
          products.map((p) => p.minOrderQty),
          "min",
        )
      : null,
  });
  const stock = products.map((p) => STOCK[p.stockStatus] ?? p.stockStatus);
  rows.push({
    key: "stock",
    label: "Availability",
    values: stock,
    differs: differs(stock),
    best: null,
  });
  const rating = products.map((p) =>
    p.ratingAvg != null && p.ratingCount > 0
      ? `${p.ratingAvg.toFixed(1)} (${p.ratingCount})`
      : null,
  );
  rows.push({
    key: "rating",
    label: "Customer rating",
    values: rating,
    differs: differs(rating),
    best: bestIndex(
      products.map((p) => (p.ratingCount > 0 ? p.ratingAvg : null)),
      "max",
    ),
  });

  for (const [key, label] of FIELD_LABELS) {
    const values = products.map((p) => p.fields[key] ?? null);
    if (!values.some(Boolean)) continue;
    rows.push({ key, label, values, differs: differs(values), best: null });
  }
  const specKeys: string[] = [];
  for (const p of products)
    for (const k of Object.keys(p.specs)) if (!specKeys.includes(k)) specKeys.push(k);
  for (const k of specKeys) {
    const values = products.map((p) => p.specs[k] ?? null);
    rows.push({ key: `spec:${k}`, label: k, values, differs: differs(values), best: null });
  }
  return rows;
}
