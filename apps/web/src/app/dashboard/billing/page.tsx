import type { Metadata } from "next";
import { requireCtx } from "@/server/access";
import { getBilling } from "@/server/services/plans";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { PlanRequestForm } from "@/components/dashboard/plan-request-form";
import { usageLevel } from "@/lib/plans";
import { formatDate } from "@/lib/utils";
import { roleHas } from "@bmn/config";

export const metadata: Metadata = { title: "Plan & usage" };

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const u = usageLevel(used, limit);
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted">
          {limit === null ? `${used} (unlimited)` : `${used} of ${limit}`}
        </span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={u.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full ${u.level === "full" ? "bg-red-600" : u.level === "warn" ? "bg-amber-500" : "bg-brand-600"}`}
          style={{ width: `${limit === null ? 0 : u.percent}%` }}
        />
      </div>
    </div>
  );
}

export default async function BillingPage() {
  const ctx = await requireCtx();
  const b = await getBilling(ctx);
  const canRequest = roleHas(ctx.role, "org.manage");
  const pending = b.requests.find((r) => r.status === "PENDING");
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Plan & usage" />
      {b.limits.lapsed ? (
        <Alert tone="error">
          Your paid plan has ended, so Free limits apply. Nothing was removed; you just cannot add
          more than the Free limits until you renew.
        </Alert>
      ) : null}
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{b.limits.planName}</h2>
          <Badge tone={b.limits.lapsed ? "red" : "green"}>
            {b.limits.lapsed ? "Ended" : "Active"}
          </Badge>
        </div>
        {b.subscription?.currentPeriodEnd && b.limits.planCode !== "FREE" ? (
          <p className="mt-1 text-sm text-muted">
            Paid until {formatDate(b.subscription.currentPeriodEnd)}
            {b.limits.daysLeft !== null && b.limits.daysLeft >= 0
              ? ` (${b.limits.daysLeft} days left)`
              : ""}
          </p>
        ) : null}
        <div className="mt-4 space-y-3">
          <Meter label="Active products" used={b.usage.products} limit={b.limits.productLimit} />
          <Meter label="RFQs in the last 30 days" used={b.usage.rfqs} limit={b.limits.rfqLimit} />
        </div>
      </Card>
      {pending ? (
        <Alert>
          Your request for the <strong>{pending.planCode}</strong> plan is waiting for review.
        </Alert>
      ) : canRequest ? (
        <PlanRequestForm
          plans={b.plans
            .filter((p) => p.code !== "FREE")
            .map((p) => ({ code: p.code, name: p.name, priceMonthlyCents: p.priceMonthlyCents }))}
          currentCode={b.limits.planCode}
        />
      ) : (
        <Card className="text-sm text-muted">
          Ask an owner or admin of your company to change the plan.
        </Card>
      )}
      {b.requests.length ? (
        <Card>
          <h2 className="font-semibold">Recent requests</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {b.requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-medium">{r.planCode}</span>
                <Badge
                  tone={
                    r.status === "APPROVED" ? "green" : r.status === "REJECTED" ? "red" : "amber"
                  }
                >
                  {r.status.toLowerCase()}
                </Badge>
                <span className="text-muted">{formatDate(r.createdAt)}</span>
                {r.reviewNote ? <span className="text-muted">· {r.reviewNote}</span> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
