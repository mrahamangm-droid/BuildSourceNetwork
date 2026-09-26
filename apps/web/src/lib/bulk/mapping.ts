import { FIELDS, type FieldKey } from "./fields";
import type { Grid } from "./csv";

export const normHeader = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)|\*/g, " ") // "Price (AED) *" -> "price"
    .replace(/[^\p{L}\p{N}]+/gu, "");

export type ColumnMap = Partial<Record<FieldKey, number>>;

const ALIAS = new Map<string, FieldKey>();
for (const f of FIELDS) {
  ALIAS.set(normHeader(f.label), f.key);
  for (const a of f.aliases) if (!ALIAS.has(normHeader(a))) ALIAS.set(normHeader(a), f.key);
}

/**
 * Maps header cells to fields. Exact known names win, then unambiguous "starts with" matches
 * ("Wholesale price AED" -> wholesalePrice). Each field is used at most once, first column wins.
 */
export function autoMapColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const used = new Set<number>();
  const take = (key: FieldKey, i: number) => {
    if (map[key] === undefined && !used.has(i)) {
      map[key] = i;
      used.add(i);
    }
  };
  const norm = headers.map(normHeader);
  norm.forEach((h, i) => {
    const k = ALIAS.get(h);
    if (k) take(k, i);
  });
  // Longer aliases first so "wholesale price" beats "price".
  const prefixes = [...ALIAS.entries()]
    .filter(([a]) => a.length >= 4)
    .sort((a, b) => b[0].length - a[0].length);
  norm.forEach((h, i) => {
    if (used.has(i) || !h) return;
    const hit = prefixes.find(([a]) => h.startsWith(a) || (a.length >= 6 && h.includes(a)));
    if (hit) take(hit[1], i);
  });
  return map;
}

/** The header row is the first of the top rows that looks like column names. */
export function detectHeaderRow(rows: Grid, look = 15): number {
  let best = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, look); i++) {
    const cells = rows[i]!.filter((c) => c && c.trim());
    if (cells.length < 2) continue;
    const m = autoMapColumns(rows[i]!);
    const score = Object.keys(m).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

export function missingRequired(
  map: ColumnMap,
  required: FieldKey[],
  allowUpdateOnly = false,
): FieldKey[] {
  if (allowUpdateOnly && map.sku !== undefined) return [];
  return required.filter((k) => map[k] === undefined);
}
