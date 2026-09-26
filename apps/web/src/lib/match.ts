/**
 * Smart Material Matching. Pure scoring: given a buyer's free-text need and candidate products,
 * rank them and say why. No database access here, so it is easy to test and to explain.
 */
export type MatchCandidate = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  brandName: string | null;
  categoryName: string;
  price: number;
  minOrderQty: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | string;
  city: string | null;
  deliveryAvailable: boolean;
  orgId: string;
  orgName: string;
  orgCity: string | null;
  orgVerified: boolean;
  deliveryAreas: string[];
};

export type MatchQuery = { q: string; city?: string; qty?: number };
export type Scored<T> = { item: T; score: number; reasons: string[] };

const STOP = new Set(["and", "the", "for", "with", "from", "per", "need", "want", "buy", "supply"]);

/** Lower-case words and numbers (keeps "42.5", "20mm"), minus filler words. */
export function tokenize(q: string): string[] {
  const out: string[] = [];
  for (const raw of q.toLowerCase().split(/[^a-z0-9.]+/)) {
    const t = raw.replace(/^\.+|\.+$/g, "");
    if (!t || STOP.has(t) || (t.length < 2 && !/\d/.test(t))) continue;
    if (!out.includes(t)) out.push(t);
    if (out.length >= 8) break;
  }
  return out;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase();

export function servesCity(c: MatchCandidate, city: string | undefined): boolean {
  const want = norm(city).trim();
  if (!want) return false;
  return (
    norm(c.city) === want ||
    norm(c.orgCity) === want ||
    c.deliveryAreas.some((a) => norm(a) === want)
  );
}

export function scoreCandidate(
  c: MatchCandidate,
  query: MatchQuery,
  medianPrice: number | null,
): Scored<MatchCandidate> {
  const tokens = tokenize(query.q);
  const reasons: string[] = [];
  let score = 0;

  if (tokens.length) {
    const nameHay = `${norm(c.name)} ${norm(c.brandName)} ${norm(c.sku)}`;
    const wideHay = `${nameHay} ${norm(c.categoryName)} ${norm(c.description)}`;
    const inName = tokens.filter((t) => nameHay.includes(t)).length;
    const inWide = tokens.filter((t) => wideHay.includes(t)).length;
    score += (inName / tokens.length) * 45 + ((inWide - inName) / tokens.length) * 15;
    if (inName === tokens.length) reasons.push("Matches every word you typed");
    else if (inWide === tokens.length) reasons.push("Matches your description");
    else if (inWide > 0) reasons.push(`Matches ${inWide} of ${tokens.length} keywords`);
    if (norm(c.name).includes(query.q.trim().toLowerCase()) && query.q.trim().length > 2)
      score += 8;
  }

  if (c.stockStatus === "IN_STOCK") {
    score += 15;
    reasons.push("In stock");
  } else if (c.stockStatus === "LOW_STOCK") {
    score += 8;
    reasons.push("Limited stock");
  } else if (c.stockStatus === "OUT_OF_STOCK") {
    score -= 25;
  }

  if (query.city?.trim()) {
    if (servesCity(c, query.city)) {
      score += 12;
      reasons.push(`Serves ${query.city.trim()}`);
    } else if (!c.deliveryAvailable) {
      score -= 6;
    }
  }
  if (c.deliveryAvailable) score += 3;
  if (c.orgVerified) {
    score += 8;
    reasons.push("Verified supplier");
  }
  if (query.qty && query.qty > 0 && c.minOrderQty > 0) {
    if (c.minOrderQty <= query.qty) score += 4;
    else {
      score -= 4;
      reasons.push(`Minimum order ${c.minOrderQty}`);
    }
  }
  if (medianPrice && medianPrice > 0 && c.price > 0) {
    const ratio = c.price / medianPrice;
    if (ratio <= 0.95) {
      score += 8;
      reasons.push(`${Math.round((1 - ratio) * 100)}% below typical price`);
    } else if (ratio <= 1.05) score += 4;
  }
  return { item: c, score: Math.round(score * 10) / 10, reasons };
}

export const median = (xs: number[]): number | null => {
  const a = xs.filter((x) => x > 0).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
};

/** Ranks candidates, then keeps only the best product per supplier so results read as a shortlist. */
export function rankMatches(
  cands: MatchCandidate[],
  query: MatchQuery,
  limit = 10,
): Scored<MatchCandidate>[] {
  const med = median(cands.map((c) => c.price));
  const scored = cands
    .map((c) => scoreCandidate(c, query, med))
    .sort((a, b) => b.score - a.score || a.item.price - b.item.price);
  const seen = new Set<string>();
  const out: Scored<MatchCandidate>[] = [];
  for (const s of scored) {
    if (seen.has(s.item.orgId)) continue;
    seen.add(s.item.orgId);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}
