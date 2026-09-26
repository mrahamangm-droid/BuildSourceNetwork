import type { MetadataRoute } from "next";
import { db } from "@bmn/database";
import { slugify } from "@bmn/config";
import { appUrl } from "@/lib/utils";
import { publishedForSitemap } from "@/server/services/blog";
import { CALCULATORS } from "@/lib/calculators";

export const dynamic = "force-dynamic";

/** Only pages backed by real records are listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const [cats, products, orgs, catCity, posts] = await Promise.all([
    db.category.findMany({
      where: { products: { some: { isActive: true, org: { isActive: true } } } },
      select: { slug: true },
    }),
    db.product.findMany({
      where: { isActive: true, org: { isActive: true } },
      select: { id: true, updatedAt: true },
      take: 5000,
    }),
    db.organization.findMany({
      where: { isActive: true, type: { in: ["SUPPLIER", "STORE"] } },
      select: { slug: true, type: true, updatedAt: true },
      take: 5000,
    }),
    db.product.findMany({
      where: { isActive: true, city: { not: null }, org: { isActive: true } },
      distinct: ["categoryId", "city"],
      select: { city: true, category: { select: { slug: true } } },
    }),
    publishedForSitemap(),
  ]);
  const now = new Date();
  return [
    ...[
      "",
      "/marketplace",
      "/suppliers",
      "/manufacturers",
      "/stores",
      "/blog",
      "/pricing",
      "/building-materials",
      "/tools",
    ].map((p) => ({ url: `${base}${p}`, lastModified: now })),
    ...CALCULATORS.map((c) => ({ url: `${base}/tools/${c.slug}`, lastModified: now })),
    ...cats.map((c) => ({ url: `${base}/building-materials/${c.slug}`, lastModified: now })),
    ...catCity.map((x) => ({
      url: `${base}/building-materials/${x.category.slug}/${slugify(x.city!)}`,
      lastModified: now,
    })),
    ...posts.map((x) => ({ url: `${base}/blog/${x.slug}`, lastModified: x.updatedAt })),
    ...products.map((p) => ({ url: `${base}/products/${p.id}`, lastModified: p.updatedAt })),
    ...orgs.map((o) => ({
      url: `${base}/${o.type === "STORE" ? "stores" : "suppliers"}/${o.slug}`,
      lastModified: o.updatedAt,
    })),
  ];
}
