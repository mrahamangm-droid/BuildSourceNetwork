import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/access";
import { listPlanRequests } from "@/server/services/plans";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { PlanReviewForm } from "@/components/dashboard/admin-forms";
import { formatDate } from "@/lib/utils";
import { ORG_TYPE_LABEL, type OrgType } from "@bmn/config";

export const metadata: Metadata = { title: "Plan requests" };

export default async function PlanRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const a = await requireAdmin();
  const { tab } = await searchParams;
  const status = tab === "APPROVED" || tab === "REJECTED" ? tab : "PENDING";
  const rows = await listPlanRequests({ userId: a.id, isPlatformAdmin: true }, status);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Plan requests"
        description="Confirm payment outside the platform, record the reference, then activate."
      />
      <div className="flex gap-3 text-sm">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((t) => (
          <Link
            key={t}
            href={`/admin/plans?tab=${t}`}
            className={status === t ? "font-semibold text-brand-700" : "text-slate-600"}
          >
            {t === "PENDING" ? "Pending" : t === "APPROVED" ? "Approved" : "Rejected"}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? <EmptyState title="Nothing here" /> : null}
      {rows.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{r.org.name}</p>
            <Badge tone="brand">{ORG_TYPE_LABEL[r.org.type as OrgType]}</Badge>
            <span className="text-sm text-muted">{r.org.city}</span>
          </div>
          <p className="mt-2 text-sm">
            Requests <strong>{r.plan.name}</strong>
            {r.plan.priceMonthlyCents ? ` ($${r.plan.priceMonthlyCents / 100}/month)` : ""} ·
            current plan {r.org.subscription?.planCode ?? "none"} · sent {formatDate(r.createdAt)}
          </p>
          <p className="text-sm text-muted">Contact: {r.org.email ?? r.org.phone ?? "—"}</p>
          {r.note ? <p className="mt-1 text-sm">{r.note}</p> : null}
          {status === "PENDING" ? (
            <PlanReviewForm requestId={r.id} />
          ) : r.reviewNote ? (
            <p className="mt-2 text-sm text-muted">Note: {r.reviewNote}</p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
