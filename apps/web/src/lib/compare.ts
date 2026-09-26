/**
 * Supplier comparison for an RFQ. Scores each submitted quote on total price, delivery time,
 * how much of the requested quantity it covers, verification and location. The weights are
 * deliberately simple and shown to the buyer as "Best value", never hidden behind a number.
 */
export type CompareQuote = {
  id: string;
  total: number;
  deliveryDays: number | null;
  /** 0..1 share of requested line quantities the supplier can supply. */
  coverage: number;
  verified: boolean;
  sameCity: boolean;
};

export const WEIGHTS = {
  price: 45,
  delivery: 20,
  coverage: 20,
  verified: 10,
  location: 5,
} as const;

export function valueScores(quotes: CompareQuote[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!quotes.length) return out;
  const minTotal = Math.min(...quotes.map((q) => q.total).filter((t) => t > 0));
  const days = quotes.map((q) => q.deliveryDays).filter((d): d is number => d != null && d >= 0);
  const minDays = days.length ? Math.min(...days) : null;
  for (const q of quotes) {
    const price = q.total > 0 && Number.isFinite(minTotal) ? minTotal / q.total : 0;
    const delivery =
      q.deliveryDays == null || minDays == null ? 0.5 : (minDays + 1) / (q.deliveryDays + 1);
    const s =
      price * WEIGHTS.price +
      delivery * WEIGHTS.delivery +
      Math.max(0, Math.min(1, q.coverage)) * WEIGHTS.coverage +
      (q.verified ? WEIGHTS.verified : 0) +
      (q.sameCity ? WEIGHTS.location : 0);
    out.set(q.id, Math.round(s * 10) / 10);
  }
  return out;
}

/** Best-value quote id, only when at least two quotes are being compared. */
export function bestValueId(quotes: CompareQuote[]): string | null {
  if (quotes.length < 2) return null;
  let best: [string, number] | null = null;
  for (const [id, s] of valueScores(quotes)) if (!best || s > best[1]) best = [id, s];
  return best?.[0] ?? null;
}

/** Share of requested quantities covered (each line capped at 100%). */
export function coverageOf(lines: { requested: number; available: number | null }[]): number {
  if (!lines.length) return 0;
  const parts = lines.map((l) =>
    l.requested > 0 && l.available != null ? Math.min(1, l.available / l.requested) : 0,
  );
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}
