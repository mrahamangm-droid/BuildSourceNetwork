/**
 * Rules for tying an order's lines to the supplier's stock. Pure, no I/O.
 *
 * Per line: NONE -> RESERVED -> ISSUED (goods left) or RELEASED (back on the shelf).
 * A released line can be reserved again. ISSUED is final: stock that left is corrected
 * with a stock take, never silently added back.
 */
export type OrderStockState = "NONE" | "RESERVED" | "ISSUED" | "RELEASED";
export type OrderStockAction = "reserve" | "issue" | "release";

export const STOCK_STATE_LABEL: Record<OrderStockState, string> = {
  NONE: "Not linked",
  RESERVED: "Reserved",
  ISSUED: "Issued",
  RELEASED: "Released",
};

/** Order statuses in which stock may be reserved. */
export const RESERVABLE_ORDER_STATUSES = ["CONFIRMED", "PREPARING"] as const;

export function nextState(state: OrderStockState, action: OrderStockAction): OrderStockState | null {
  switch (action) {
    case "reserve":
      return state === "NONE" || state === "RELEASED" ? "RESERVED" : null;
    case "issue":
      return state === "RESERVED" ? "ISSUED" : null;
    case "release":
      return state === "RESERVED" ? "RELEASED" : null;
  }
}

/** What an order status change should do to reserved stock automatically. */
export function autoActionFor(orderStatus: string): OrderStockAction | null {
  if (orderStatus === "DISPATCHED") return "issue";
  if (orderStatus === "CANCELLED") return "release";
  return null;
}

const STOP = new Set(["the", "of", "and", "for", "with", "a", "an", "in", "to", "pcs", "piece"]);
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t && !STOP.has(t)),
  );

/**
 * Best-guess product for an order line: same unit, and at least 60% of the line's words
 * appear in the product name. Returns "" when nothing qualifies or two candidates tie, so a
 * wrong guess is never pre-selected.
 */
export function suggestProduct(
  line: { name: string; unitCode: string },
  products: { id: string; name: string; unitCode: string }[],
): string {
  const want = tokens(line.name);
  if (!want.size) return "";
  let best = "";
  let bestScore = 0;
  let tie = false;
  for (const p of products) {
    if (p.unitCode !== line.unitCode) continue;
    const have = tokens(p.name);
    let hit = 0;
    for (const t of want) if (have.has(t)) hit++;
    const score = hit / want.size;
    if (score < 0.6) continue;
    if (score > bestScore) {
      best = p.id;
      bestScore = score;
      tie = false;
    } else if (score === bestScore) tie = true;
  }
  return tie ? "" : best;
}
