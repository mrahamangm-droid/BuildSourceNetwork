import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCtx } from "@/server/access";
import { listCustomers } from "@/server/services/customers";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { roleHas } from "@bmn/config";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; owing?: string }>;
}) {
  const ctx = await requireCtx();
  if (!["SUPPLIER", "STORE"].includes(ctx.orgType) || !roleHas(ctx.role, "customer.manage"))
    redirect("/dashboard");
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const owingOnly = sp.owing === "1";
  const rows = await listCustomers(ctx, { q, owingOnly });
  const totalOwed = rows.reduce((s, r) => s + Math.max(r.balance, 0), 0);
  const totalOverdue = rows.reduce((s, r) => s + r.overdue, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description="Your customer book: credit limits, invoices, payments and statements."
        action={<LinkButton href="/dashboard/customers/new">Add customer</LinkButton>}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs uppercase text-muted">Total outstanding</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(totalOwed)}</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs uppercase text-muted">Overdue</p>
          <p className={`mt-1 text-2xl font-bold ${totalOverdue > 0 ? "text-red-700" : ""}`}>
            {formatMoney(totalOverdue)}
          </p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs uppercase text-muted">Customers</p>
          <p className="mt-1 text-2xl font-bold">{rows.length}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/dashboard/customers"
          className={`rounded-full border px-3 py-1 ${!owingOnly ? "border-brand-600 text-brand-700" : "border-line"}`}
        >
          All
        </Link>
        <Link
          href="/dashboard/customers?owing=1"
          className={`rounded-full border px-3 py-1 ${owingOnly ? "border-brand-600 text-brand-700" : "border-line"}`}
        >
          Owing
        </Link>
        <form className="ml-auto">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, contact or phone"
            className="h-9 rounded-lg border border-line px-3 text-sm"
            aria-label="Search customers"
          />
        </form>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Overdue</th>
                <th className="px-4 py-3 text-right">Credit limit</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className={r.isActive ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/customers/${r.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {r.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {[r.city, r.phone].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(r.balance)}</td>
                  <td className={`px-4 py-3 text-right ${r.overdue > 0 ? "text-red-700" : ""}`}>
                    {r.overdue > 0 ? formatMoney(r.overdue) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.creditLimit == null ? "No limit" : formatMoney(r.creditLimit)}
                  </td>
                  <td className="px-4 py-3">
                    {!r.isActive ? (
                      <Badge>Archived</Badge>
                    ) : r.overLimit ? (
                      <Badge tone="red">Over limit</Badge>
                    ) : r.overdue > 0 ? (
                      <Badge tone="amber">Overdue</Badge>
                    ) : r.balance > 0 ? (
                      <Badge tone="blue">Owing</Badge>
                    ) : (
                      <Badge tone="green">Clear</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={q || owingOnly ? "No matching customers" : "No customers yet"}
          body="Add a customer to start raising invoices and tracking what they owe."
          action={<LinkButton href="/dashboard/customers/new">Add customer</LinkButton>}
        />
      )}
    </div>
  );
}
