import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCtx } from "@/server/access";
import { LinkButton, PageHeader } from "@/components/ui";
import { BulkJobView } from "@/components/dashboard/bulk-job-view";

export const metadata: Metadata = { title: "Bulk upload" };
export const dynamic = "force-dynamic";

export default async function BulkJobPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  if (!["SUPPLIER", "STORE"].includes(ctx.orgType)) redirect("/dashboard");
  const { id } = await params;
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Bulk upload"
        description="Review, import and, if needed, undo."
        action={
          <LinkButton href="/dashboard/products/bulk" variant="outline">
            New upload
          </LinkButton>
        }
      />
      <BulkJobView id={id} />
    </div>
  );
}
