import { beforeAll, describe, expect, it } from "vitest";
import { makeAccount, resetDb } from "./helpers";

let sf: typeof import("@/server/services/storefront");
let orgs: typeof import("@/server/services/orgs");
let products: typeof import("@/server/services/products");
let db: typeof import("@bmn/database").db;

beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
  sf = await import("@/server/services/storefront");
  orgs = await import("@/server/services/orgs");
  products = await import("@/server/services/products");
});

describe("storefront", () => {
  it("features a limited number of own products and filters by them", async () => {
    const a = await makeAccount("SUPPLIER", { name: "Front A" });
    const b = await makeAccount("SUPPLIER", { name: "Front B" });
    const cats = await db.category.findMany({ take: 2, orderBy: { name: "asc" } });
    const mk = (orgId: string, i: number, categoryId = cats[0]!.id) =>
      db.product.create({
        data: {
          orgId,
          categoryId,
          unitCode: "BAG",
          name: `P${orgId.slice(-4)}-${i}`,
          slug: `p-${orgId.slice(-4)}-${i}`,
          price: 5,
        },
      });
    const mine = [];
    for (let i = 0; i < sf.MAX_FEATURED + 1; i++) mine.push(await mk(a.ctx.orgId, i));
    const other = await mk(b.ctx.orgId, 0, cats[1]!.id);

    for (let i = 0; i < sf.MAX_FEATURED; i++) await sf.setFeatured(a.ctx, mine[i]!.id, true);
    await expect(sf.setFeatured(a.ctx, mine[sf.MAX_FEATURED]!.id, true)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await sf.setFeatured(a.ctx, mine[0]!.id, true); // already featured: no-op, not blocked
    await expect(sf.setFeatured(a.ctx, other.id, true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(sf.setFeatured(b.ctx, mine[0]!.id, false)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await sf.setFeatured(a.ctx, mine[0]!.id, false);
    await sf.setFeatured(a.ctx, mine[sf.MAX_FEATURED]!.id, true);

    const slug = (await db.organization.findUniqueOrThrow({ where: { id: a.ctx.orgId } })).slug;
    const feat = await products.searchProducts({ supplier: slug, featured: true });
    expect(feat.total).toBe(sf.MAX_FEATURED);
    expect(feat.items.every((p) => p.org.slug === slug)).toBe(true);
    expect((await products.searchProducts({ supplier: slug })).total).toBe(sf.MAX_FEATURED + 1);
  });

  it("counts categories per storefront and ignores hidden products", async () => {
    const a = await makeAccount("STORE", { name: "Front Cats" });
    const cats = await db.category.findMany({ take: 2, orderBy: { name: "asc" } });
    const mk = (n: string, categoryId: string, isActive = true) =>
      db.product.create({
        data: {
          orgId: a.ctx.orgId,
          categoryId,
          unitCode: "BAG",
          name: n,
          slug: n,
          price: 1,
          isActive,
        },
      });
    await mk("c1", cats[0]!.id);
    await mk("c2", cats[0]!.id);
    await mk("c3", cats[1]!.id);
    await mk("hidden", cats[1]!.id, false);
    const res = await sf.storefrontCategories(a.ctx.orgId);
    expect(res.map((c) => [c.slug, c.count])).toEqual([
      [cats[0]!.slug, 2],
      [cats[1]!.slug, 1],
    ]);
  });

  it("saves and publishes the tagline and policies", async () => {
    const a = await makeAccount("SUPPLIER", { name: "Front Profile" });
    const org = await db.organization.findUniqueOrThrow({ where: { id: a.ctx.orgId } });
    await orgs.updateOrgProfile(a.ctx, {
      name: org.name,
      city: "Sharjah",
      tagline: "Cement and steel, delivered next day",
      policies: "Delivery within 48 hours.\nNo returns on cut steel.",
    });
    const pub = await orgs.getPublicOrg(org.slug, "SUPPLIER");
    expect(pub!.org.tagline).toBe("Cement and steel, delivered next day");
    expect(pub!.org.policies).toContain("No returns");
    await expect(
      orgs.updateOrgProfile(a.ctx, { name: org.name, city: "Sharjah", tagline: "x".repeat(200) }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
