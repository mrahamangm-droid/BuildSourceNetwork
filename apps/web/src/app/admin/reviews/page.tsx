import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/access";
import { getModerationQueue } from "@/server/services/reviews";
import { moderateReviewAction } from "@/server/actions";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { Stars } from "@/components/market/stars";
import { REPORT_REASONS } from "@/lib/reviews";

export const metadata: Metadata = { title: "Review moderation" };

const reasonLabel = (v: string) => REPORT_REASONS.find((r) => r.value === v)?.label ?? v;

function Act({
  kind,
  id,
  action,
  label,
  danger,
}: {
  kind: "PRODUCT" | "ORDER";
  id: string;
  action: "HIDE" | "RESTORE" | "DISMISS_REPORTS";
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={moderateReviewAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="reviewId" value={id} />
      <input type="hidden" name="action" value={action} />
      <Button type="submit" size="sm" variant={danger ? "danger" : "outline"}>
        {label}
      </Button>
    </form>
  );
}

export default async function ReviewModeration() {
  const a = await requireAdmin();
  const q = await getModerationQueue({ userId: a.id, isPlatformAdmin: true });
  return (
    <div className="space-y-8">
      <PageHeader
        title="Review moderation"
        description="Reported product reviews, hidden reviews and the latest supplier reviews. Nothing is hidden automatically."
      />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reported product reviews ({q.reported.length})</h2>
        {q.reported.length === 0 ? <EmptyState title="No reported reviews" /> : null}
        {q.reported.map((r) => (
          <Card key={r.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={r.rating} />
              <Badge tone="red">
                {r.reportCount} report{r.reportCount === 1 ? "" : "s"}
              </Badge>
              <Link
                className="text-sm text-brand-700 hover:underline"
                href={`/products/${r.product.id}#reviews`}
              >
                {r.product.name}
              </Link>
              <span className="text-xs text-muted">by {r.authorOrg.name}</span>
            </div>
            {r.title ? <p className="font-medium">{r.title}</p> : null}
            {r.body ? <p className="whitespace-pre-line text-sm">{r.body}</p> : null}
            <ul className="text-xs text-muted">
              {r.reports.map((rep, i) => (
                <li key={i}>
                  {reasonLabel(rep.reason)}
                  {rep.note ? `: ${rep.note}` : ""}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Act kind="PRODUCT" id={r.id} action="HIDE" label="Hide review" danger />
              <Act kind="PRODUCT" id={r.id} action="DISMISS_REPORTS" label="Dismiss reports" />
            </div>
          </Card>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Hidden product reviews</h2>
        {q.hidden.length === 0 ? <EmptyState title="Nothing hidden" /> : null}
        {q.hidden.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <Stars value={r.rating} /> {r.product.name} · {r.authorOrg.name}
              {r.body ? <p className="mt-1 text-slate-700">{r.body}</p> : null}
            </div>
            <Act kind="PRODUCT" id={r.id} action="RESTORE" label="Restore" />
          </Card>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Latest supplier reviews (from orders)</h2>
        {q.orderReviews.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <Stars value={r.rating} /> {r.subjectOrg.name}, by {r.authorOrg.name}
              {r.status === "HIDDEN" ? (
                <Badge tone="red" className="ml-2">
                  Hidden
                </Badge>
              ) : null}
              {r.comment ? <p className="mt-1 text-slate-700">{r.comment}</p> : null}
            </div>
            {r.status === "HIDDEN" ? (
              <Act kind="ORDER" id={r.id} action="RESTORE" label="Restore" />
            ) : (
              <Act kind="ORDER" id={r.id} action="HIDE" label="Hide" danger />
            )}
          </Card>
        ))}
      </section>
    </div>
  );
}
