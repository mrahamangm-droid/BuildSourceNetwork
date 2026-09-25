import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCtx } from "@/server/access";
import { getCustomerLedger } from "@/server/services/customers";
import { voidPaymentAction } from "@/server/actions";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { CustomerForm, InvoiceForm, PaymentForm, VoidInvoiceForm } from "@/components/dashboard/customer-forms";
import { AGING_BUCKETS, fromCents } from "@/lib/ledger";
import { formatDate, formatMoney } from "@/lib/utils";
import { roleHas } from "@bmn/config";

export const metadata: Metadata = { title: "Customer" };

const statusTone = { PAID: "green", OPEN: "blue", PARTIAL: "blue", OVERDUE: "red", VOID: "neutral" } as const;

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  if (!["SUPPLIER", "STORE"].includes(ctx.orgType) || !roleHas(ctx.role, "customer.manage"))
    redirect("/dashboard");
  const { id } = await params;
  const l = await getCustomerLedger(ctx, id);
  if (!l) notFound();
  const c = l.customer;
  const canVoid = ctx.role === "OWNER" || ctx.role === "ADMIN";
  const open = l.invoices.filter((i) => i.status !== "VOID" && i.outstanding > 0);
  const usedPct = l.creditLimit && l.creditLimit > 0 ? Math.min(Math.round((Math.max(l.balance, 0) / l.creditLimit) * 100), 100) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        description={[c.contactName, c.phone, c.email, c.city].filter(Boolean).join(" · ") || undefined}
        action={<Link href="/dashboard/customers" className="text-sm text-brand-700 hover:underline">All customers</Link>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase text-muted">Balance owing</p>
          <p className={`mt-1 text-2xl font-bold ${l.balance > 0 ? "" : "text-emerald-700"}`}>{formatMoney(l.balance)}</p>
          {l.balance < 0 ? <p className="text-xs text-muted">Customer is in credit</p> : null}
        </Card>
        <Card>
          <p className="text-xs uppercase text-muted">Credit limit</p>
          <p className="mt-1 text-2xl font-bold">{l.creditLimit == null ? "No limit" : formatMoney(l.creditLimit)}</p>
          {l.available != null ? <p className="text-xs text-muted">{formatMoney(l.available)} available</p> : null}
          {usedPct != null ? (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={usedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Credit used">
              <div className={`h-full ${usedPct >= 100 ? "bg-red-500" : usedPct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${usedPct}%` }} />
            </div>
          ) : null}
        </Card>
        <Card>
          <p className="text-xs uppercase text-muted">Payment terms</p>
          <p className="mt-1 text-2xl font-bold">{c.paymentTermsDays} days</p>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">Ageing of what is owed</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          {AGING_BUCKETS.map((b, i) => (
            <div key={b}>
              <p className="text-xs text-muted">{b}</p>
              <p className={`font-semibold ${i > 0 && l.aging[i] > 0 ? "text-red-700" : ""}`}>{formatMoney(l.aging[i])}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <InvoiceForm customerId={c.id} defaultTerms={c.paymentTermsDays} canOverride={canVoid} />
        <PaymentForm customerId={c.id} openInvoices={open.map((i) => ({ id: i.id, number: i.number, outstanding: i.outstanding }))} />
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Invoices</h2>
        {l.invoices.length ? (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Owing</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...l.invoices].reverse().map((i) => (
                  <tr key={i.id} className={i.status === "VOID" ? "opacity-60" : ""}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{i.number}</div>
                      <div className="text-xs text-muted">{i.description}{i.reference ? ` · ${i.reference}` : ""}</div>
                      {i.status === "VOID" && i.voidReason ? <div className="text-xs text-muted">Voided: {i.voidReason}</div> : null}
                      {canVoid && i.status !== "VOID" ? <div className="mt-2"><VoidInvoiceForm customerId={c.id} invoiceId={i.id} /></div> : null}
                    </td>
                    <td className="px-4 py-3">{formatDate(i.issuedAt)}</td>
                    <td className="px-4 py-3">{formatDate(i.dueAt)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(i.total)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{i.status === "VOID" ? "—" : formatMoney(i.outstanding)}</td>
                    <td className="px-4 py-3"><Badge tone={statusTone[i.status]}>{i.status.charAt(0) + i.status.slice(1).toLowerCase()}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No invoices yet.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Statement</h2>
        {l.statement.length ? (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3 text-right">Charges</th>
                  <th className="px-4 py-3 text-right">Payments</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {l.statement.map((s, idx) => (
                  <tr key={idx} className={s.voided ? "text-muted line-through" : ""}>
                    <td className="px-4 py-2">{formatDate(s.date)}</td>
                    <td className="px-4 py-2">{s.ref ? `${s.ref} · ` : ""}{s.description}{s.voided ? " (void)" : ""}</td>
                    <td className="px-4 py-2 text-right">{s.debitCents ? formatMoney(fromCents(s.debitCents)) : ""}</td>
                    <td className="px-4 py-2 text-right">{s.creditCents ? formatMoney(fromCents(s.creditCents)) : ""}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatMoney(fromCents(s.balanceCents))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">Nothing to show yet.</p>
        )}
        {canVoid && l.payments.some((p) => !p.voided) ? (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">Void a payment entered by mistake</summary>
            <ul className="mt-2 space-y-2">
              {l.payments.filter((p) => !p.voided).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                  <span>{formatDate(p.receivedAt)} · {formatMoney(p.amount)} · {p.method.replace("_", " ").toLowerCase()}{p.reference ? ` · ${p.reference}` : ""}</span>
                  <form action={voidPaymentAction}>
                    <input type="hidden" name="paymentId" value={p.id} />
                    <input type="hidden" name="customerId" value={c.id} />
                    <Button type="submit" variant="outline" size="sm">Void</Button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <details className="rounded-xl border border-line p-4">
        <summary className="cursor-pointer font-semibold">Edit customer details</summary>
        <div className="mt-4">
          <CustomerForm c={{ ...c, creditLimit: l.creditLimit }} />
        </div>
      </details>
    </div>
  );
}
