import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@bmn/database";
import { requireCtx } from "@/server/access";
import { getOwnProduct } from "@/server/services/products";
import { listBreaks } from "@/server/services/pricing";
import { PageHeader } from "@/components/ui";
import { PriceBreaksForm } from "@/components/dashboard/price-breaks-form";

export const metadata: Metadata = { title: "Volume pricing" };

export default async function PricingPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const id = (await params).id;
  const p = await getOwnProduct(ctx, id); // org-scoped
  if (!p) notFound();
  const [breaks, unit] = await Promise.all([
    listBreaks(ctx, id),
    db.unit.findUnique({ where: { code: p.unitCode }, select: { name: true } }),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Volume pricing" description={p.name} />
      <p className="mb-4 text-sm">
        <Link className="text-brand-700 hover:underline" href={`/dashboard/products/${id}`}>
          ← Back to product
        </Link>
      </p>
      <PriceBreaksForm
        productId={id}
        unit={(unit?.name ?? p.unitCode).toLowerCase()}
        currency={p.currency}
        basePrice={p.price.toString()}
        minOrderQty={p.minOrderQty.toString()}
        breaks={breaks}
      />
    </div>
  );
}
