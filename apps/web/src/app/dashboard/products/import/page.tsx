import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCtx } from "@/server/access";
import { LinkButton, PageHeader } from "@/components/ui";
import { ProductImportForm } from "@/components/dashboard/product-import-form";

export const metadata: Metadata = { title: "Import products" };

export default async function ImportProductsPage() {
  const ctx = await requireCtx();
  if (!["SUPPLIER", "STORE"].includes(ctx.orgType)) redirect("/dashboard");
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Import products"
        description="Add many products at once from a spreadsheet."
        action={
          <LinkButton href="/dashboard/products" variant="outline">
            Back to products
          </LinkButton>
        }
      />
      <ProductImportForm />
    </div>
  );
}
