import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/access";
import { listVerificationRequests } from "@/server/services/admin";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ReviewForm } from "@/components/dashboard/admin-forms";
import { ORG_TYPE_LABEL, type OrgType } from "@bmn/config";

export const metadata: Metadata = { title: "Verification queue" };

export default async function VerificationQueue({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const a = await requireAdmin();
  const { tab } = await searchParams;
  const status = tab === "VERIFIED" || tab === "REJECTED" ? tab : "PENDING";
  const rows = await listVerificationRequests({ userId: a.id, isPlatformAdmin: true }, status);
  return (
    <div className="space-y-4">
      <PageHeader title="Verification queue" />
      <div className="flex gap-3 text-sm">
        {(["PENDING", "VERIFIED", "REJECTED"] as const).map((t) => (
          <Link
            key={t}
            href={`/admin/verification?tab=${t}`}
            className={status === t ? "font-semibold text-brand-700" : "text-slate-600"}
          >
            {t === "PENDING" ? "Pending" : t === "VERIFIED" ? "Approved" : "Rejected"}
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
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="inline text-muted">Registered name: </dt>
              <dd className="inline">{r.legalName}</dd>
            </div>
            <div>
              <dt className="inline text-muted">Licence no.: </dt>
              <dd className="inline">{r.licenseNumber}</dd>
            </div>
            <div>
              <dt className="inline text-muted">Authority: </dt>
              <dd className="inline">{r.licenseAuthority ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline text-muted">Tax no.: </dt>
              <dd className="inline">{r.taxNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline text-muted">Contact: </dt>
              <dd className="inline">{r.org.email ?? r.org.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="inline text-muted">Submitted: </dt>
              <dd className="inline">{r.createdAt.toISOString().slice(0, 10)}</dd>
            </div>
          </dl>
          {r.notes ? <p className="mt-2 text-sm">{r.notes}</p> : null}
          {r.licenseDocUrl ? (
            <a
              className="mt-2 inline-block text-sm text-brand-700 hover:underline"
              href={r.licenseDocUrl}
              target="_blank"
              rel="noreferrer"
            >
              View licence document
            </a>
          ) : (
            <p className="mt-2 text-sm text-amber-700">No licence document attached.</p>
          )}
          {status === "PENDING" ? (
            <ReviewForm requestId={r.id} />
          ) : r.reviewNote ? (
            <p className="mt-2 text-sm text-muted">Note: {r.reviewNote}</p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
