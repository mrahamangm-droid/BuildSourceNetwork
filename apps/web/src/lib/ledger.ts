/**
 * Pure customer-ledger maths. No I/O. All money is handled as integer cents so totals never drift.
 *
 * Model: a customer's balance is (sum of non-void invoices) - (sum of non-void payments).
 * A payment may be allocated to one invoice; unallocated payments are applied first-in-first-out
 * to the oldest outstanding invoices when working out what is overdue.
 */
export type InvoiceRow = { id: string; number: string; issuedAt: Date; dueAt: Date; totalCents: number; voided: boolean };
export type PaymentRow = { id: string; invoiceId: string | null; amountCents: number; receivedAt: Date; voided: boolean };

export const toCents = (n: number) => Math.round((n + Number.EPSILON) * 100);
export const fromCents = (c: number) => c / 100;

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function invoiceTotals(subtotalCents: number, vatPercent: number) {
  const vat = Math.round((subtotalCents * vatPercent) / 100);
  return { subtotalCents, vatCents: vat, totalCents: subtotalCents + vat };
}

export function dueDateFor(issued: Date, termsDays: number) {
  const d = new Date(issued);
  d.setUTCDate(d.getUTCDate() + Math.max(0, Math.floor(termsDays)));
  return d;
}

export function balanceCents(invoices: InvoiceRow[], payments: PaymentRow[]) {
  const billed = invoices.filter((i) => !i.voided).reduce((s, i) => s + i.totalCents, 0);
  const paid = payments.filter((p) => !p.voided).reduce((s, p) => s + p.amountCents, 0);
  return billed - paid;
}

/** Amount still owing per (non-void) invoice, after allocated payments and FIFO application of unallocated ones. */
export function outstandingByInvoice(invoices: InvoiceRow[], payments: PaymentRow[]) {
  const live = invoices.filter((i) => !i.voided).sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime());
  const out = new Map<string, number>();
  for (const i of live) out.set(i.id, i.totalCents);
  let floating = 0;
  for (const p of payments) {
    if (p.voided) continue;
    if (p.invoiceId && out.has(p.invoiceId)) out.set(p.invoiceId, out.get(p.invoiceId)! - p.amountCents);
    else floating += p.amountCents;
  }
  // Overpayments on one invoice do not vanish: they join the floating credit.
  for (const i of live) {
    const left = out.get(i.id)!;
    if (left < 0) {
      floating += -left;
      out.set(i.id, 0);
    }
  }
  for (const i of live) {
    if (floating <= 0) break;
    const left = out.get(i.id)!;
    const use = Math.min(left, floating);
    out.set(i.id, left - use);
    floating -= use;
  }
  return out;
}

export type InvoiceStatus = "VOID" | "PAID" | "PARTIAL" | "OVERDUE" | "OPEN";

export function invoiceStatus(inv: InvoiceRow, outstandingCents: number, now = new Date()): InvoiceStatus {
  if (inv.voided) return "VOID";
  if (outstandingCents <= 0) return "PAID";
  if (inv.dueAt.getTime() < now.getTime()) return "OVERDUE";
  return outstandingCents < inv.totalCents ? "PARTIAL" : "OPEN";
}

export const AGING_BUCKETS = ["Not yet due", "1-30 days", "31-60 days", "61-90 days", "Over 90 days"] as const;

export function aging(invoices: InvoiceRow[], payments: PaymentRow[], now = new Date()) {
  const outstanding = outstandingByInvoice(invoices, payments);
  const buckets = [0, 0, 0, 0, 0];
  for (const i of invoices) {
    if (i.voided) continue;
    const owed = outstanding.get(i.id) ?? 0;
    if (owed <= 0) continue;
    const daysLate = Math.floor((now.getTime() - i.dueAt.getTime()) / 86_400_000);
    const idx = daysLate <= 0 ? 0 : daysLate <= 30 ? 1 : daysLate <= 60 ? 2 : daysLate <= 90 ? 3 : 4;
    buckets[idx] += owed;
  }
  return buckets;
}

/** limitCents === null means no limit is enforced. */
export function creditCheck(balance: number, limitCents: number | null, newInvoiceCents: number) {
  if (limitCents === null) return { ok: true, availableCents: null as number | null, overByCents: 0 };
  const after = balance + newInvoiceCents;
  return {
    ok: after <= limitCents,
    availableCents: Math.max(limitCents - balance, 0),
    overByCents: Math.max(after - limitCents, 0),
  };
}

/** INV-2026-0001 style, sequence restarts each year. */
export function nextInvoiceNumber(existing: string[], year: number) {
  const prefix = `INV-${year}-`;
  let max = 0;
  for (const n of existing) {
    if (!n.startsWith(prefix)) continue;
    const seq = Number(n.slice(prefix.length));
    if (Number.isInteger(seq) && seq > max) max = seq;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export type StatementLine = {
  date: Date;
  kind: "INVOICE" | "PAYMENT";
  ref: string;
  description: string;
  debitCents: number;
  creditCents: number;
  balanceCents: number;
  voided: boolean;
};

/** Chronological ledger with a running balance. Void items are listed but do not move the balance. */
export function buildStatement(
  invoices: (InvoiceRow & { description?: string })[],
  payments: (PaymentRow & { ref?: string; method?: string })[],
): StatementLine[] {
  const items = [
    ...invoices.map((i) => ({ t: i.issuedAt.getTime(), order: 0, i })),
    ...payments.map((p) => ({ t: p.receivedAt.getTime(), order: 1, p })),
  ].sort((a, b) => a.t - b.t || a.order - b.order);
  let running = 0;
  return items.map((x): StatementLine => {
    if ("i" in x && x.i) {
      const i = x.i;
      if (!i.voided) running += i.totalCents;
      return { date: i.issuedAt, kind: "INVOICE", ref: i.number, description: i.description ?? "Invoice", debitCents: i.totalCents, creditCents: 0, balanceCents: running, voided: i.voided };
    }
    const p = (x as { p: PaymentRow & { ref?: string; method?: string } }).p;
    if (!p.voided) running -= p.amountCents;
    return { date: p.receivedAt, kind: "PAYMENT", ref: p.ref ?? "", description: `Payment${p.method ? ` (${p.method.replace("_", " ").toLowerCase()})` : ""}`, debitCents: 0, creditCents: p.amountCents, balanceCents: running, voided: p.voided };
  });
}
