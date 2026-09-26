import { describe, expect, it } from "vitest";
import {
  effectiveLimits,
  nextPeriodEnd,
  requestablePlan,
  usageLevel,
  type PlanRow,
} from "../src/lib/plans";

const plans: PlanRow[] = [
  { code: "FREE", name: "Free", productLimit: 10, rfqLimit: 5 },
  { code: "STARTER", name: "Starter", productLimit: 200, rfqLimit: 50 },
  { code: "SME", name: "SME", productLimit: null, rfqLimit: null },
];
const now = new Date("2026-10-10T00:00:00Z");
const d = (s: string) => new Date(s);

describe("effectiveLimits", () => {
  it("gives Free limits with no subscription or an unknown plan", () => {
    expect(effectiveLimits(null, plans, now).planCode).toBe("FREE");
    expect(
      effectiveLimits({ planCode: "GONE", status: "ACTIVE", currentPeriodEnd: null }, plans, now)
        .planCode,
    ).toBe("FREE");
  });
  it("applies a paid plan inside its period", () => {
    const e = effectiveLimits(
      { planCode: "STARTER", status: "ACTIVE", currentPeriodEnd: d("2026-10-20T00:00:00Z") },
      plans,
      now,
    );
    expect(e).toMatchObject({
      planCode: "STARTER",
      productLimit: 200,
      lapsed: false,
      daysLeft: 10,
    });
  });
  it("keeps paid limits during the grace window, then falls back to Free", () => {
    const sub = {
      planCode: "STARTER",
      status: "ACTIVE",
      currentPeriodEnd: d("2026-10-05T00:00:00Z"),
    };
    expect(effectiveLimits(sub, plans, now).lapsed).toBe(false); // 5 days past, grace is 7
    const later = effectiveLimits(sub, plans, d("2026-10-13T00:00:00Z"));
    expect(later).toMatchObject({ planCode: "FREE", productLimit: 10, lapsed: true });
  });
  it("treats a non-active subscription as Free, and a paid plan with no end date as active", () => {
    expect(
      effectiveLimits(
        { planCode: "STARTER", status: "CANCELLED", currentPeriodEnd: d("2027-01-01T00:00:00Z") },
        plans,
        now,
      ).lapsed,
    ).toBe(true);
    expect(
      effectiveLimits({ planCode: "SME", status: "ACTIVE", currentPeriodEnd: null }, plans, now),
    ).toMatchObject({ planCode: "SME", productLimit: null, daysLeft: null });
  });
});

describe("usageLevel", () => {
  it("classifies usage", () => {
    expect(usageLevel(3, null).level).toBe("unlimited");
    expect(usageLevel(3, 10)).toEqual({ level: "ok", percent: 30 });
    expect(usageLevel(8, 10).level).toBe("warn");
    expect(usageLevel(10, 10).level).toBe("full");
    expect(usageLevel(14, 10)).toEqual({ level: "full", percent: 100 });
    expect(usageLevel(0, 0).level).toBe("full");
  });
});

describe("nextPeriodEnd", () => {
  it("starts from today when lapsed or new, and extends a live period", () => {
    expect(nextPeriodEnd(null, now).toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(nextPeriodEnd(d("2026-10-01T00:00:00Z"), now).toISOString()).toBe(
      "2026-11-09T00:00:00.000Z",
    );
    expect(nextPeriodEnd(d("2026-10-20T00:00:00Z"), now).toISOString()).toBe(
      "2026-11-19T00:00:00.000Z",
    );
  });
});

describe("requestablePlan", () => {
  it("blocks Free and unknown plans, allows paid ones", () => {
    expect(requestablePlan("FREE", plans)).toBe(false);
    expect(requestablePlan("NOPE", plans)).toBe(false);
    expect(requestablePlan("STARTER", plans)).toBe(true);
  });
});
