import { beforeAll, describe, expect, it } from "vitest";
import { makeAccount, resetDb } from "./helpers";

let onboarding: typeof import("@/server/services/onboarding");
let db: typeof import("@bmn/database").db;
beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
  onboarding = await import("@/server/services/onboarding");
});

describe("getOnboarding", () => {
  it("is not shown to buyers", async () => {
    const b = await makeAccount("CONTRACTOR", { name: "Onb Buyer" });
    expect(await onboarding.getOnboarding(b.ctx)).toBeNull();
  });
  it("reflects real organization state as it changes", async () => {
    const s = await makeAccount("SUPPLIER", { name: "Onb Supplier" });
    const first = (await onboarding.getOnboarding(s.ctx))!;
    expect(first.total).toBe(6);
    expect(first.steps.find((x) => x.key === "email")!.state).toBe("done");
    expect(first.steps.find((x) => x.key === "products")!.state).toBe("todo");

    await db.organization.update({
      where: { id: s.ctx.orgId },
      data: { description: "Cement and blocks", phone: "+971500000001", deliveryAreas: ["Dubai"] },
    });
    const cat = await db.category.findFirstOrThrow();
    const unit = await db.unit.findFirstOrThrow();
    await db.product.create({
      data: {
        orgId: s.ctx.orgId,
        name: "Onb product",
        slug: "onb-product",
        categoryId: cat.id,
        unitCode: unit.code,
        price: 10,
        isActive: true,
        images: { create: [{ url: "https://example.com/a.png" }] },
      },
    });
    const later = (await onboarding.getOnboarding(s.ctx))!;
    const st = (k: string) => later.steps.find((x) => x.key === k)!.state;
    expect(st("terms")).toBe("done");
    expect(st("products")).toBe("done");
    expect(st("photos")).toBe("done");
    expect(st("profile")).toBe("todo"); // logo still missing
    expect(later.done).toBeGreaterThan(first.done);
  });
});
