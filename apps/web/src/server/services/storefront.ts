import { db } from "@bmn/database";
import { assertCan, type Ctx } from "../ctx";
import { AppError } from "../errors";

export const MAX_FEATURED = 8;

/** Categories a storefront actually sells in, with how many active products each holds. */
export async function storefrontCategories(orgId: string) {
  const groups = await db.product.groupBy({
    by: ["categoryId"],
    where: { orgId, isActive: true },
    _count: { _all: true },
  });
  if (!groups.length) return [];
  const cats = await db.category.findMany({
    where: { id: { in: groups.map((g) => g.categoryId) } },
    select: { id: true, name: true, slug: true },
  });
  const count = new Map(groups.map((g) => [g.categoryId, g._count._all]));
  return cats
    .map((c) => ({ name: c.name, slug: c.slug, count: count.get(c.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Pin or unpin a product on the company's own storefront (a handful of products at most). */
export async function setFeatured(ctx: Ctx, productId: string, on: boolean) {
  assertCan(ctx, "product.manage");
  const p = await db.product.findFirst({
    where: { id: productId, orgId: ctx.orgId },
    select: { id: true, isFeatured: true },
  });
  if (!p) throw new AppError("Product not found", "NOT_FOUND");
  if (on && !p.isFeatured) {
    const n = await db.product.count({ where: { orgId: ctx.orgId, isFeatured: true } });
    if (n >= MAX_FEATURED)
      throw new AppError(
        `You can feature up to ${MAX_FEATURED} products. Remove one first.`,
        "CONFLICT",
      );
  }
  await db.product.update({ where: { id: p.id }, data: { isFeatured: on } });
}
