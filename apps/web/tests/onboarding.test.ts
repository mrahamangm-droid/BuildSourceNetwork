import { describe, expect, it } from "vitest";
import { buildOnboardingSteps, onboardingProgress, type OnboardingInput } from "@/lib/onboarding";

const base: OnboardingInput = {
  emailVerified: false,
  description: null,
  phone: null,
  logoUrl: null,
  deliveryAreas: 0,
  leadTimeDays: null,
  minOrderNote: null,
  activeProducts: 0,
  productsWithPhoto: 0,
  verificationStatus: "UNVERIFIED",
};
const state = (i: OnboardingInput, key: string) =>
  buildOnboardingSteps(i).find((s) => s.key === key)!.state;

describe("buildOnboardingSteps", () => {
  it("starts with everything to do and lists what is missing from the profile", () => {
    const steps = buildOnboardingSteps(base);
    expect(steps.every((s) => s.state === "todo")).toBe(true);
    expect(steps.find((s) => s.key === "profile")!.detail).toMatch(/description, phone, logo/);
    expect(onboardingProgress(steps)).toEqual({ done: 0, total: 6, percent: 0 });
  });
  it("needs description, phone and logo before the profile is done", () => {
    const p = { ...base, description: "We sell cement", phone: "+971500000000" };
    expect(state(p, "profile")).toBe("todo");
    expect(state({ ...p, logoUrl: "https://x/y.png" }, "profile")).toBe("done");
    expect(state({ ...p, description: "   ", logoUrl: "https://x/y.png" }, "profile")).toBe("todo");
  });
  it("counts any one of delivery areas, lead time or order note as terms", () => {
    expect(state(base, "terms")).toBe("todo");
    expect(state({ ...base, deliveryAreas: 2 }, "terms")).toBe("done");
    expect(state({ ...base, leadTimeDays: 0 }, "terms")).toBe("done");
    expect(state({ ...base, minOrderNote: "Min 10 bags" }, "terms")).toBe("done");
  });
  it("points to the import page until a product exists, and photos wait on products", () => {
    const none = buildOnboardingSteps(base).find((s) => s.key === "products")!;
    expect(none.href).toBe("/dashboard/products/import");
    const some = buildOnboardingSteps({ ...base, activeProducts: 3 });
    expect(some.find((s) => s.key === "products")!.state).toBe("done");
    expect(some.find((s) => s.key === "photos")!.state).toBe("todo");
    expect(state({ ...base, activeProducts: 3, productsWithPhoto: 1 }, "photos")).toBe("done");
  });
  it("maps each verification status to a step state", () => {
    expect(state({ ...base, verificationStatus: "UNVERIFIED" }, "verification")).toBe("todo");
    expect(state({ ...base, verificationStatus: "REJECTED" }, "verification")).toBe("todo");
    expect(state({ ...base, verificationStatus: "PENDING" }, "verification")).toBe("waiting");
    expect(state({ ...base, verificationStatus: "VERIFIED" }, "verification")).toBe("done");
    expect(
      buildOnboardingSteps({ ...base, verificationStatus: "REJECTED" }).find(
        (s) => s.key === "verification",
      )!.cta,
    ).toMatch(/Resubmit/);
  });
});
