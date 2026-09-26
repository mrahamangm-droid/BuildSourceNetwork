import { db } from "@bmn/database";
import type { CompareProduct } from "@/lib/product-compare";

/** Active products for the comparison table, in the order requested. Public data only. */
export async function getCompareProducts(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.product.findMany({
    where: { id: { in: ids }, isActive: true, org: { isActive: true } },
    include: {
      unit: true,
      category: true,
      brand: true,
      manufacturer: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      priceBreaks: { orderBy: { minQty: "asc" } },
      org: { select: { name: true, slug: true, type: true, verificationStatus: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((p) => ({
      id: p.id,
      image: p.images[0]?.url ?? null,
      orgHref: `/${p.org.type === "STORE" ? "stores" : "suppliers"}/${p.org.slug}`,
      verified: p.org.verificationStatus === "VERIFIED",
      data: {
        id: p.id,
        name: p.name,
        price: Number(p.price),
        currency: p.currency,
        unit: p.unit.name.toLowerCase(),
        minOrderQty: Number(p.minOrderQty),
        stockStatus: p.stockStatus,
        ratingAvg: p.ratingAvg == null ? null : Number(p.ratingAvg),
        ratingCount: p.ratingCount,
        breaks: p.priceBreaks.map((b) => ({ minQty: Number(b.minQty), price: Number(b.price) })),
        fields: {
          category: p.category.name,
          brand: p.brand?.name ?? null,
          manufacturer: p.manufacturer?.name ?? null,
          packageSize: p.packageSize,
          material: p.material,
          grade: p.grade,
          size: p.size,
          dimensions: p.dimensions,
          color: p.color,
          finish: p.finish,
          application: p.application,
          countryOfOrigin: p.countryOfOrigin,
          supplier: p.org.name,
          city: p.city,
          delivery: p.deliveryAvailable ? "Available" : "Pick-up only",
        },
        specs: Object.fromEntries(
          Object.entries((p.specifications ?? {}) as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string" || typeof v === "number")
            .map(([k, v]) => [k, String(v)]),
        ),
      } satisfies CompareProduct,
    }));
}
