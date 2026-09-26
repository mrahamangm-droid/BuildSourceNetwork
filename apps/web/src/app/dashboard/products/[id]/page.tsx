import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@bmn/database";
import { requireCtx } from "@/server/access";
import { getOwnProduct } from "@/server/services/products";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/dashboard/product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const p = await getOwnProduct(ctx, (await params).id); // org-scoped: other companies' ids return null
  if (!p) notFound();
  const [categories, units] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.unit.findMany({ orderBy: { name: "asc" }, select: { code: true, name: true } }),
  ]);
  const specs =
    p.specifications && typeof p.specifications === "object"
      ? Object.entries(p.specifications as Record<string, string>)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      : "";
  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit product" description={p.name} />
      <p className="mb-4 text-sm">
        <Link className="text-brand-700 hover:underline" href={`/dashboard/products/${p.id}/pricing`}>
          Volume pricing (quantity breaks) →
        </Link>
      </p>
      <ProductForm
        categories={categories}
        units={units}
        values={{
          id: p.id,
          name: p.name,
          sku: p.sku,
          categoryId: p.categoryId,
          brandName: p.brand?.name,
          unitCode: p.unitCode,
          description: p.description,
          packageSize: p.packageSize,
          minOrderQty: p.minOrderQty.toString(),
          stockStatus: p.stockStatus,
          price: p.price.toString(),
          wholesalePrice: p.wholesalePrice?.toString() ?? null,
          contractorPrice: p.contractorPrice?.toString() ?? null,
          vatRatePercent: p.vatRatePercent.toString(),
          city: p.city,
          deliveryAvailable: p.deliveryAvailable,
          isActive: p.isActive,
          specifications: specs,
          imageUrl: p.images[0]?.url ?? null,
        }}
      />
    </div>
  );
}
