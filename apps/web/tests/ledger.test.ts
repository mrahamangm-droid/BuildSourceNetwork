import { describe, expect, it } from "vitest";
import {
  aging,
  balanceCents,
  buildStatement,
  creditCheck,
  dueDateFor,
  invoiceStatus,
  invoiceTotals,
  nextInvoiceNumber,
  outstandingByInvoice,
  toCents,
  type InvoiceRow,
  type PaymentRow,
} from "@/lib/ledger";

const d = (s: string) => new Date(s + "T00:00:00Z");
const inv = (
  id: string,
  issued: string,
  due: string,
  total: number,
  voided = false,
): InvoiceRow => ({
  id,
  number: id,
  issuedAt: d(issued),
  dueAt: d(due),
  totalCents: toCents(total),
  voided,
});
const pay = (
  id: string,
  invoiceId: string | null,
  amount: number,
  at: string,
  voided = false,
): PaymentRow => ({
  id,
  invoiceId,
  amountCents: toCents(amount),
  receivedAt: d(at),
  voided,
});

describe("ledger", () => {
  it("converts money to cents without float drift", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1.005)).toBe(101);
    expect(invoiceTotals(toCents(1000), 5)).toEqual({
      subtotalCents: 100000,
      vatCents: 5000,
      totalCents: 105000,
    });
    expect(invoiceTotals(toCents(33.33), 5).totalCents).toBe(3500);
  });
  it("balance ignores void invoices and void payments", () => {
    const invs = [
      inv("a", "2026-01-01", "2026-01-31", 100),
      inv("b", "2026-02-01", "2026-03-03", 50, true),
    ];
    const pays = [pay("p1", "a", 30, "2026-01-10"), pay("p2", null, 999, "2026-01-11", true)];
    expect(balanceCents(invs, pays)).toBe(7000);
  });
  it("applies unallocated payments first-in-first-out", () => {
    const invs = [
      inv("old", "2026-01-01", "2026-01-31", 100),
      inv("new", "2026-02-01", "2026-03-03", 100),
    ];
    const out = outstandingByInvoice(invs, [pay("p", null, 130, "2026-02-10")]);
    expect(out.get("old")).toBe(0);
    expect(out.get("new")).toBe(7000);
  });
  it("carries an overpayment on one invoice to the next", () => {
    const invs = [
      inv("a", "2026-01-01", "2026-01-31", 100),
      inv("b", "2026-02-01", "2026-03-03", 100),
    ];
    const out = outstandingByInvoice(invs, [pay("p", "a", 150, "2026-01-05")]);
    expect(out.get("a")).toBe(0);
    expect(out.get("b")).toBe(5000);
  });
  it("derives invoice status", () => {
    const now = d("2026-03-01");
    const i = inv("a", "2026-01-01", "2026-01-31", 100);
    expect(invoiceStatus(i, 0, now)).toBe("PAID");
    expect(invoiceStatus(i, 4000, now)).toBe("OVERDUE");
    const future = inv("f", "2026-02-20", "2026-03-20", 100);
    expect(invoiceStatus(future, 10000, now)).toBe("OPEN");
    expect(invoiceStatus(future, 6000, now)).toBe("PARTIAL");
    expect(invoiceStatus(inv("v", "2026-01-01", "2026-01-31", 100, true), 10000, now)).toBe("VOID");
  });
  it("buckets overdue amounts by age", () => {
    const now = d("2026-06-01");
    const invs = [
      inv("current", "2026-05-20", "2026-06-19", 10),
      inv("d20", "2026-04-11", "2026-05-12", 20),
      inv("d45", "2026-03-01", "2026-04-17", 30),
      inv("d75", "2026-02-01", "2026-03-18", 40),
      inv("d120", "2025-11-01", "2026-01-31", 50),
    ];
    expect(aging(invs, [], now)).toEqual([1000, 2000, 3000, 4000, 5000]);
  });
  it("checks credit limits, and treats null as no limit", () => {
    expect(creditCheck(80000, 100000, 20000).ok).toBe(true);
    const over = creditCheck(80000, 100000, 30000);
    expect(over.ok).toBe(false);
    expect(over.overByCents).toBe(10000);
    expect(over.availableCents).toBe(20000);
    expect(creditCheck(999999, null, 999999).ok).toBe(true);
  });
  it("numbers invoices per year and never reuses a number", () => {
    expect(nextInvoiceNumber([], 2026)).toBe("INV-2026-0001");
    expect(
      nextInvoiceNumber(["INV-2026-0001", "INV-2026-0007", "INV-2025-0099", "junk"], 2026),
    ).toBe("INV-2026-0008");
    expect(nextInvoiceNumber(["INV-2025-0099"], 2026)).toBe("INV-2026-0001");
  });
  it("builds a statement whose last balance equals the ledger balance", () => {
    const invs = [
      inv("A", "2026-01-01", "2026-01-31", 100),
      inv("B", "2026-02-01", "2026-03-03", 200),
      inv("X", "2026-02-02", "2026-03-04", 500, true),
    ];
    const pays = [pay("p1", "A", 100, "2026-01-15"), pay("p2", null, 50, "2026-02-10")];
    const s = buildStatement(invs, pays);
    expect(s.map((l) => l.balanceCents)).toEqual([10000, 0, 20000, 20000, 15000]);
    expect(s.at(-1)!.balanceCents).toBe(balanceCents(invs, pays));
    expect(s.find((l) => l.ref === "X")!.voided).toBe(true);
  });
  it("computes due dates from payment terms", () => {
    expect(dueDateFor(d("2026-01-31"), 30).toISOString().slice(0, 10)).toBe("2026-03-02");
    expect(dueDateFor(d("2026-01-31"), 0).toISOString().slice(0, 10)).toBe("2026-01-31");
  });
});
