/**
 * Volume pricing. Pure functions, no I/O.
 * Money is integer cents; quantities are integer thousandths, so comparisons never
 * suffer from floating point drift (0.1 + 0.2 style bugs).
 */

export const toCents = (n: number) => Math.round(n * 100);
export const fromCents = (c: number) => c / 100;
export const toMilli = (n: number) => Math.round(n * 1000);

export type Break = { minQty: number; price: number };

export const MAX_BREAKS = 6;

/** Best price for a quantity: the highest break whose minQty is <= qty, else the base price. */
export function unitPriceFor(basePrice: number, breaks: Break[], qty: number): number {
  const q = toMilli(qty);
  let best = toCents(basePrice);
  let bestQty = -1;
  for (const b of breaks) {
    const bq = toMilli(b.minQty);
    if (bq <= q && bq > bestQty) {
      bestQty = bq;
      best = toCents(b.price);
    }
  }
  // If the base price was lowered after breaks were set, a stale break must never cost more.
  return fromCents(Math.min(best, toCents(basePrice)));
}

/** Line total in cents-exact arithmetic. */
export function lineTotal(basePrice: number, breaks: Break[], qty: number): number {
  const unitCents = toCents(unitPriceFor(basePrice, breaks, qty));
  return fromCents(Math.round((unitCents * toMilli(qty)) / 1000));
}

/** Percentage saved versus the base price, one decimal. */
export function savingsPercent(basePrice: number, price: number): number {
  if (basePrice <= 0) return 0;
  return Math.round(((basePrice - price) / basePrice) * 1000) / 10;
}

export type BreakIssue = { row: number; field: "minQty" | "price" | "row"; message: string };

/**
 * Validates a proposed break table against the product.
 * Rules: every break is above the minimum order (a break at or below it would never
 * apply as a separate tier); quantities are unique; a bigger quantity must be strictly
 * cheaper; every break is cheaper than the base price.
 * Rows may be given in any order; the returned `sorted` list is ascending by quantity.
 */
export function validateBreaks(
  rows: Break[],
  product: { price: number; minOrderQty: number },
): { sorted: Break[]; issues: BreakIssue[] } {
  const issues: BreakIssue[] = [];
  if (rows.length > MAX_BREAKS)
    issues.push({ row: MAX_BREAKS, field: "row", message: `Use at most ${MAX_BREAKS} price breaks.` });
  rows.forEach((r, i) => {
    if (!Number.isFinite(r.minQty) || r.minQty <= 0)
      issues.push({ row: i, field: "minQty", message: "Quantity must be greater than 0." });
    else if (toMilli(r.minQty) <= toMilli(product.minOrderQty))
      issues.push({
        row: i,
        field: "minQty",
        message: `Must be above the minimum order (${product.minOrderQty}).`,
      });
    if (!Number.isFinite(r.price) || r.price <= 0)
      issues.push({ row: i, field: "price", message: "Price must be greater than 0." });
    else if (toCents(r.price) >= toCents(product.price))
      issues.push({
        row: i,
        field: "price",
        message: `Must be below the base price (${product.price.toFixed(2)}).`,
      });
  });
  if (issues.length) return { sorted: [], issues };

  const idx = rows.map((r, i) => ({ ...r, i })).sort((a, b) => toMilli(a.minQty) - toMilli(b.minQty));
  for (let k = 1; k < idx.length; k++) {
    const prev = idx[k - 1];
    const cur = idx[k];
    if (toMilli(cur.minQty) === toMilli(prev.minQty))
      issues.push({ row: cur.i, field: "minQty", message: "Two breaks share the same quantity." });
    else if (toCents(cur.price) >= toCents(prev.price))
      issues.push({
        row: cur.i,
        field: "price",
        message: "A larger quantity must have a lower price than the tier before it.",
      });
  }
  return {
    sorted: issues.length ? [] : idx.map(({ minQty, price }) => ({ minQty, price })),
    issues,
  };
}
