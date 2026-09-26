import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCtx } from "@/server/access";
import { LinkButton, PageHeader } from "@/components/ui";
import { BulkMediaUploader } from "@/components/dashboard/bulk-media-uploader";

export const metadata: Metadata = { title: "Bulk photos and documents" };

export default async function BulkMediaPage() {
  const ctx = await requireCtx();
  if (!["SUPPLIER", "STORE"].includes(ctx.orgType)) redirect("/dashboard");
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Bulk photos and documents"
        description="Attach product photos and datasheets to many products at once, matched by SKU."
        action={
          <LinkButton href="/dashboard/products" variant="outline">
            Back to products
          </LinkButton>
        }
      />
      <BulkMediaUploader />
    </div>
  );
}
