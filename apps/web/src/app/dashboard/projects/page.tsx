import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCtx } from "@/server/access";
import { listProjects } from "@/server/services/projects";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { fromCents, PROJECT_KIND_LABEL, PROJECT_STATUS_LABEL, type ProjectKind, type ProjectStatusValue } from "@/lib/boq";
import { BUYER_TYPES, roleHas } from "@bmn/config";

export const metadata: Metadata = { title: "Projects & BOQ" };

export default async function ProjectsPage() {
  const ctx = await requireCtx();
  if (!BUYER_TYPES.includes(ctx.orgType) || !roleHas(ctx.role, "project.manage")) redirect("/dashboard");
  const rows = await listProjects(ctx);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects & BOQ"
        description="Plan materials per project, price the bill of quantities and track it against your budget."
        action={<LinkButton href="/dashboard/projects/new">New project</LinkButton>}
      />
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">BOQ lines</th>
                <th className="px-4 py-3 text-right">Estimated cost</th>
                <th className="px-4 py-3 text-right">Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/projects/${p.id}`} className="font-medium hover:text-brand-700">
                      {p.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {PROJECT_KIND_LABEL[p.kind as ProjectKind] ?? p.kind}
                      {p.city ? ` · ${p.city}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={p.status === "ACTIVE" ? "green" : p.status === "ON_HOLD" ? "amber" : "neutral"}>
                      {PROJECT_STATUS_LABEL[p.status as ProjectStatusValue]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.itemCount}
                    {p.unpriced ? <span className="block text-xs text-amber-700">{p.unpriced} unpriced</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right">{formatMoney(fromCents(p.totalCents))}</td>
                  <td className="px-4 py-3 text-right">{p.budget === null ? "—" : formatMoney(p.budget)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No projects yet"
          body="Create a project, then add lines by hand or generate a starter bill from the floor area."
          action={<LinkButton href="/dashboard/projects/new">New project</LinkButton>}
        />
      )}
    </div>
  );
}
