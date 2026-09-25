import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/access";
import { adminOverview } from "@/server/services/admin";
import { Card, PageHeader } from "@/components/ui";
import { ORG_TYPE_LABEL, type OrgType } from "@bmn/config";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  const a = await requireAdmin();
  const o = await adminOverview({ userId: a.id, isPlatformAdmin: true });
  const stat = (label: string, value: string | number, href?: string) => (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">
        {href ? (
          <Link href={href} className="hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </p>
    </Card>
  );
  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Live companies only; demo data is excluded." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat("Companies", o.totalOrgs, "/admin/organizations")}
        {stat("Users", o.users)}
        {stat("Pending verifications", o.pendingVerif, "/admin/verification")}
        {stat("Open RFQs", o.openRfqs)}
        {stat("RFQs (30 days)", o.rfqs30)}
        {stat("Orders (30 days)", o.orders30)}
        {stat("Order value (30 days)", `AED ${ o.gmv30.toLocaleString("en-AE", { maximumFractionDigits: 0 })}`)}
      </div>
      <Card>
        <h2 className="mb-2 font-semibold">Companies by type</h2>
        <ul className="text-sm">
          {o.orgsByType.map((t) => (
            <li key={t.type}>
              {ORG_TYPE_LABEL[t.type as OrgType]}: {t.count}
            </li>
          ))}
          {o.orgsByType.length === 0 ? <li className="text-muted">No companies yet.</li> : null}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">Recent activity</h2>
        <ul className="divide-y divide-line text-sm">
          {o.recent.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <code>{r.action}</code>
                {r.org ? ` · ${ r.org.name}` : ""}
              </span>
              <span className="text-muted">
                {r.actor?.email ?? "system"} · {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>
            </li>
          ))}
          {o.recent.length === 0 ? <li className="py-2 text-muted">Nothing yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
