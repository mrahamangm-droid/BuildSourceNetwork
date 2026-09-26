import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCtx } from "@/server/access";
import { getProject } from "@/server/services/projects";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { AddItemForm, BoqRow, ProjectForm, StarterForm } from "@/components/dashboard/project-forms";
import { formatMoney } from "@/lib/utils";
import {
  fromCents,
  lineCostCents,
  orderQty,
  PROJECT_STATUS_LABEL,
  type ProjectStatusValue,
} from "@/lib/boq";
import { BUYER_TYPES, roleHas } from "@bmn/config";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  if (!BUYER_TYPES.includes(ctx.orgType) || !roleHas(ctx.role, "project.manage")) redirect("/dashboard");
  const id = (await params).id;
  const data = await getProject(ctx, id); // org scoped
  if (!data) notFound();
  const { project: p, summary: s } = data;
  const money = (c: number) => formatMoney(fromCents(c));
  return (
    <div className="space-y-6">
      <PageHeader
        title={p.name}
        description={p.city ?? undefined}
        action={<Badge tone={p.status === "ACTIVE" ? "green" : "neutral"}>{PROJECT_STATUS_LABEL[p.status as ProjectStatusValue]}</Badge>}
      />
      <p className="text-sm">
        <Link className="text-brand-700 hover:underline" href="/dashboard/projects">
          ← All projects
        </Link>
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs uppercase text-muted">Estimated cost</p>
          <p className="mt-1 text-2xl font-bold">{money(s.totalCents)}</p>
          {s.unpriced ? <p className="text-xs text-amber-700">{s.unpriced} lines have no rate yet, so the total is incomplete.</p> : null}
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs uppercase text-muted">Budget</p>
          <p className="mt-1 text-2xl font-bold">{p.budget === null ? "—" : formatMoney(p.budget)}</p>
          {s.budgetUsedPercent !== null ? <p className="text-xs text-muted">{s.budgetUsedPercent}% used</p> : null}
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs uppercase text-muted">Remaining</p>
          <p className={`mt-1 text-2xl font-bold ${s.varianceCents !== null && s.varianceCents < 0 ? "text-red-700" : ""}`}>
            {s.varianceCents === null ? "—" : money(s.varianceCents)}
          </p>
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Bill of quantities</h2>
          {s.itemCount ? (
            <a className="text-sm text-brand-700 hover:underline" href={`/dashboard/projects/${id}/export`}>
              Download CSV
            </a>
          ) : null}
        </div>
        {s.sections.length ? (
          <form id="boq-rfq" action="/dashboard/rfqs/new" method="get" className="mb-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="projectId" value={id} />
            <Button type="submit" variant="outline" size="sm">
              Request quotes for ticked lines
            </Button>
            <span className="text-xs text-muted">
              Tick material lines (up to 30). Works items such as excavation or formwork are not materials.
            </span>
          </form>
        ) : null}
        {s.sections.length ? (
          <div className="space-y-4">
            {s.sections.map((sec) => (
              <Card key={sec.section} className="overflow-x-auto p-0">
                <table className="w-full text-left text-sm">
                  <caption className="flex justify-between bg-surface px-3 py-2 text-left text-xs font-semibold uppercase text-muted">
                    <span>{sec.section}</span>
                    <span>{money(sec.subtotalCents)}</span>
                  </caption>
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Quantity</th>
                      <th className="px-3 py-2">Waste %</th>
                      <th className="px-3 py-2">Rate</th>
                      <th className="px-3 py-2 text-right">Cost</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {sec.items.map((i) => {
                      const c = lineCostCents(i);
                      return (
                        <BoqRow
                          key={`${i.id}:${i.quantity}:${i.wastePercent}:${i.unitRate}`}
                          projectId={id}
                          item={i}
                          orderQty={orderQty(i)}
                          cost={c === null ? "—" : money(c)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-sm text-muted">No lines yet. Add them below or generate a starter bill.</Card>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <AddItemForm projectId={id} sections={s.sections.map((x) => x.section)} />
        <StarterForm projectId={id} />
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Project details</h2>
        <ProjectForm
          p={{
            id,
            name: p.name,
            kind: p.kind,
            status: p.status,
            city: p.city,
            startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
            budget: p.budget,
            notes: p.notes,
          }}
        />
      </section>
    </div>
  );
}
