/**
 * Split award: the buyer picks, line by line, which supplier gets each item of an RFQ. Pure helpers
 * shared by the server (which builds the orders from them) and the browser (live totals), so what the
 * buyer sees is exactly what gets ordered.
 */
export type AwardItem = { id: string; name: string; quantity: number };
export type AwardQuote = { id: string; deliveryCost: number };
export type AwardOffer = {
  quoteId: string;
  rfqItemId: string;
  unitPrice: number;
  quantityAvailable: number;
};
/** rfqItemId -> quoteId, or null when the buyer does not want to order that item. */
export type Assignment = Record<string, string | null>;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Quantity that would actually be ordered for one line: what the supplier has, capped at the ask. */
export function orderedQty(item: AwardItem, offer: AwardOffer | undefined): number {
  if (!offer) return 0;
  return Math.max(0, Math.min(offer.quantityAvailable, item.quantity));
}

/**
 * A sensible starting point: for every item, the cheapest supplier that can supply the full quantity;
 * if nobody can, the one that can supply the most (cheapest on ties). Items nobody offers stay unassigned.
 */
export function suggestAssignment(
  items: AwardItem[],
  quotes: AwardQuote[],
  offers: AwardOffer[],
): Assignment {
  const valid = new Set(quotes.map((q) => q.id));
  const out: Assignment = {};
  for (const item of items) {
    const cands = offers
      .filter((o) => o.rfqItemId === item.id && valid.has(o.quoteId))
      .map((o) => ({ o, qty: orderedQty(item, o) }))
      .filter((c) => c.qty > 0);
    cands.sort((a, b) => {
      const fa = a.qty >= item.quantity ? 1 : 0;
      const fb = b.qty >= item.quantity ? 1 : 0;
      if (fa !== fb) return fb - fa;
      if (!fa && a.qty !== b.qty) return b.qty - a.qty;
      return a.o.unitPrice - b.o.unitPrice;
    });
    out[item.id] = cands[0]?.o.quoteId ?? null;
  }
  return out;
}

export type AwardLine = {
  rfqItemId: string;
  name: string;
  quantity: number;
  requested: number;
  unitPrice: number;
  lineTotal: number;
};
export type AwardOrderPlan = {
  quoteId: string;
  lines: AwardLine[];
  subtotal: number;
  deliveryCost: number;
  total: number;
};
export type AwardSummary = {
  orders: AwardOrderPlan[];
  grandTotal: number;
  /** Items left out on purpose or because the chosen supplier has none. */
  unassigned: string[];
  /** Items ordered for less than the requested quantity. */
  short: string[];
};

/** One order per supplier that received at least one line. Delivery is charged once per order. */
export function summarizeAward(
  items: AwardItem[],
  quotes: AwardQuote[],
  offers: AwardOffer[],
  assignment: Assignment,
): AwardSummary {
  const byQuote = new Map<string, AwardLine[]>();
  const unassigned: string[] = [];
  const short: string[] = [];
  for (const item of items) {
    const quoteId = assignment[item.id] ?? null;
    const offer = quoteId
      ? offers.find((o) => o.quoteId === quoteId && o.rfqItemId === item.id)
      : undefined;
    const qty = orderedQty(item, offer);
    if (!quoteId || !offer || qty <= 0) {
      unassigned.push(item.id);
      continue;
    }
    if (qty < item.quantity) short.push(item.id);
    const list = byQuote.get(quoteId) ?? [];
    list.push({
      rfqItemId: item.id,
      name: item.name,
      quantity: qty,
      requested: item.quantity,
      unitPrice: offer.unitPrice,
      lineTotal: round2(qty * offer.unitPrice),
    });
    byQuote.set(quoteId, list);
  }
  const orders: AwardOrderPlan[] = [];
  for (const [quoteId, lines] of byQuote) {
    const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    const deliveryCost = quotes.find((q) => q.id === quoteId)?.deliveryCost ?? 0;
    orders.push({ quoteId, lines, subtotal, deliveryCost, total: round2(subtotal + deliveryCost) });
  }
  return {
    orders,
    grandTotal: round2(orders.reduce((s, o) => s + o.total, 0)),
    unassigned,
    short,
  };
}
