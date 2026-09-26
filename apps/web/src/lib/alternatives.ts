/**
 * Smart Alternatives. Suggests comparable products when the exact one is unavailable, too far or
 * too expensive. "Comparable" means the same category and unit, ranked by how close it is to the
 * original. Pure: candidates come pre-filtered from the database.
 */
export type AltBase = {
  id: string;
  orgId: string;
  brandId: string | null;
  price: number;
  city: string | null;
  specifications: Record<string, string>;
};
export type AltCandidate = AltBase & {
  name: string;
  stockStatus: string;
  deliveryAvailable: boolean;
  orgVerified: boolean;
  orgCity: string | null;
  deliveryAreas: string[];
};
export type Alternative<T extends AltCandidate = AltCandidate> = {
  item: T;
  score: number;
  reasons: string[];
};

const eq = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Number of specification keys with identical values (e.g. grade, thickness). */
export function specOverlap(a: Record<string, string>, b: Record<string, string>): number {
  let n = 0;
  for (const [k, v] of Object.entries(a)) {
    const other = Object.entries(b).find(([k2]) => eq(k, k2))?.[1];
    if (other !== undefined && eq(String(v), String(other))) n++;
  }
  return n;
}

export function rankAlternatives<T extends AltCandidate>(
  base: AltBase,
  candidates: T[],
  opts: { city?: string | null; limit?: number } = {},
): Alternative<T>[] {
  const city = opts.city ?? base.city;
  const out: Alternative<T>[] = [];
  for (const c of candidates) {
    if (c.id === base.id) continue;
    const reasons: string[] = [];
    let score = 0;

    if (c.stockStatus === "OUT_OF_STOCK") continue;
    if (c.stockStatus === "IN_STOCK") {
      score += 20;
      reasons.push("In stock");
    } else score += 8;

    if (base.brandId && c.brandId === base.brandId) {
      score += c.orgId !== base.orgId ? 16 : 6;
      if (c.orgId !== base.orgId) reasons.push("Same brand, different supplier");
    }
    const overlap = specOverlap(base.specifications, c.specifications);
    if (overlap) {
      score += Math.min(overlap, 4) * 3;
      reasons.push(`${overlap} matching specification${overlap === 1 ? "" : "s"}`);
    }
    if (base.price > 0 && c.price > 0) {
      const diff = (c.price - base.price) / base.price;
      if (diff < -0.02) {
        score += 10 + Math.min(-diff, 0.3) * 20;
        reasons.push(`${Math.round(-diff * 100)}% cheaper`);
      } else if (diff <= 0.15) score += 8;
      else score -= Math.min(diff, 1) * 10;
    }
    if (
      city &&
      (eq(c.city, city) || eq(c.orgCity, city) || c.deliveryAreas.some((a) => eq(a, city)))
    ) {
      score += 10;
      reasons.push(`Serves ${city}`);
    }
    if (c.orgVerified) {
      score += 6;
      reasons.push("Verified supplier");
    }
    out.push({ item: c, score: Math.round(score * 10) / 10, reasons });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 4);
}
