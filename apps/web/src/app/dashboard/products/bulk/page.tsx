import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCtx } from "@/server/access";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { BulkUploadWizard } from "@/components/dashboard/bulk-upload-wizard";
import { listImportJobs } from "@/server/services/bulk-import";

export const metadata: Metadata = { title: "Bulk upload products" };
export const dynamic = "force-dynamic";

export default async function BulkUploadPage() {
  const ctx = await requireCtx();
  if (!["SUPPLIER", "STORE"].includes(ctx.orgType)) redirect("/dashboard");
  const jobs = await listImportJobs(ctx, 10);
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Bulk upload"
        description="Add or update thousands of products from Excel or CSV, with checks before anything is saved."
        action={
          <LinkButton href="/dashboard/products" variant="outline">
            Back to products
          </LinkButton>
        }
      />
      <BulkUploadWizard />
      {jobs.length ? (
        <Card className="mt-8">
          <h2 className="text-lg font-semibold">Recent uploads</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link
                  href={`/dashboard/products/bulk/${j.id}`}
                  className="font-medium hover:text-brand-700"
                >
                  {j.filename}
                </Link>
                <span className="flex items-center gap-2 text-muted">
                  {j.totalRows.toLocaleString("en")} rows · {j.createdAt.toISOString().slice(0, 10)}
                  <Badge>{j.status.replace(/_/g, " ").toLowerCase()}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
