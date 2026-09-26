/**
 * Plan limits and lifecycle. Pure, no I/O.
 *
 * Paid plans are activated by an admin for a fixed period (online billing is not connected).
 * When that period lapses, limits fall back to the Free plan after a short grace window, so an
 * unpaid plan cannot keep paid limits forever. Nothing is deleted on a downgrade: existing
 * products stay live, only adding more is blocked.
 */
export type PlanRow = {
  code: string;
  name: string;
  productLimit: number | null;
  rfqLimit: number | null;
};
export type SubRow = { planCode: string; status: string; currentPeriodEnd: Date | null };

export const GRACE_DAYS = 7;
export const PERIOD_DAYS = 30;
const DAY = 86_400_000;

export type EffectiveLimits = {
  planCode: string;
  planName: string;
  productLimit: number | null;
  rfqLimit: number | null;
  /** True when a paid plan has run out and Free limits apply. */
  lapsed: boolean;
  /** Days left in the paid period (negative once past), null when there is no end date. */
  daysLeft: number | null;
};

export function effectiveLimits(
  sub: SubRow | null,
  plans: PlanRow[],
  now = new Date(),
): EffectiveLimits {
  const free = plans.find((p) => p.code === "FREE") ?? {
    code: "FREE",
    name: "Free",
    productLimit: 10,
    rfqLimit: 5,
  };
  const plan = sub ? plans.find((p) => p.code === sub.planCode) : undefined;
  const daysLeft = sub?.currentPeriodEnd
    ? Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / DAY)
    : null;
  const asFree = (lapsed: boolean): EffectiveLimits => ({
    planCode: free.code,
    planName: free.name,
    productLimit: free.productLimit,
    rfqLimit: free.rfqLimit,
    lapsed,
    daysLeft,
  });
  if (!sub || !plan) return asFree(false);
  if (plan.code === "FREE") return asFree(false);
  if (sub.status !== "ACTIVE") return asFree(true);
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() + GRACE_DAYS * DAY < now.getTime())
    return asFree(true);
  return {
    planCode: plan.code,
    planName: plan.name,
    productLimit: plan.productLimit,
    rfqLimit: plan.rfqLimit,
    lapsed: false,
    daysLeft,
  };
}

export type UsageLevel = "unlimited" | "ok" | "warn" | "full";

export function usageLevel(
  used: number,
  limit: number | null,
): { level: UsageLevel; percent: number } {
  if (limit === null) return { level: "unlimited", percent: 0 };
  if (limit <= 0) return { level: "full", percent: 100 };
  const percent = Math.min(100, Math.round((used / limit) * 100));
  return { level: used >= limit ? "full" : percent >= 80 ? "warn" : "ok", percent };
}

/** New period end when an admin approves: renewals extend from the current end, not from today. */
export function nextPeriodEnd(currentEnd: Date | null, now = new Date()): Date {
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  return new Date(base.getTime() + PERIOD_DAYS * DAY);
}

/** Free is the default and cannot be requested; anything else (including a renewal) can. */
export function requestablePlan(code: string, plans: PlanRow[]): boolean {
  return code !== "FREE" && plans.some((p) => p.code === code);
}
