import type { Metadata } from "next";
import { db } from "@bmn/database";
import { requireCtx } from "@/server/access";
import { Alert, PageHeader } from "@/components/ui";
import { RfqForm } from "@/components/dashboard/rfq-form";
import { BUYER_TYPES } from "@bmn/config";

export const metadata: Metadata = { title: "Request quotes" };

type SP = {
  productId?: string;
  category?: string;
  city?: string;
  material?: string;
  supplier?: string;
  mode?: string;
};

export default async function NewRfqPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const authed = await requireCtx();
  if (!BUYER_TYPES.includes(authed.orgType))
    return (
      <div>
        <PageHeader title="Request quotes" />
        <Alert>
          Supplier accounts respond to quote requests rather than send them. Register a separate
          store, contractor or buyer account to request quotes.
        </Alert>
      </div>
    );
  const [categories, units, product, supplier, org] = await Promise.all([
    db.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    db.unit.findMany({ orderBy: { name: "asc" }, select: { code: true, name: true } }),
    sp.productId
      ? db.product.findFirst({
          where: { id: sp.productId, isActive: true },
          select: { id: true, name: true, categoryId: true, unitCode: true, city: true },
        })
      : null,
    sp.supplier
      ? db.organization.findFirst({
          where: { id: sp.supplier, type: "SUPPLIER", isActive: true },
          select: { id: true, name: true },
        })
      : null,
    db.organization.findUniqueOrThrow({ where: { id: authed.orgId }, select: { city: true } }),
  ]);
  const cat = sp.category ? categories.find((c) => c.slug === sp.category) : undefined;
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Request quotes"
        description="Tell us what you need. Matching suppliers reply with prices you can compare side by side."
      />
      <RfqForm
        categories={categories}
        units={units}
        initialItem={{
          name: product?.name ?? sp.material ?? "",
          categoryId: product?.categoryId ?? cat?.id ?? "",
          productId: product?.id ?? "",
          unitCode: product?.unitCode ?? "",
        }}
        initialCity={sp.city ?? ""}
        defaultCity={org.city ?? ""}
        supplierOrgId={supplier?.id}
        supplierName={supplier?.name}
        initialMode={sp.mode === "custom" ? "custom" : "get3"}
      />
    </div>
  );
}
