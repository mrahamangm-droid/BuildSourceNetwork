import { z } from "zod";
import { db, Prisma } from "@bmn/database";
import { assertCan, assertOrgType, assertVerified, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { fieldErrorsFrom } from "./accounts";
import { audit } from "./notify";
import {
  aging,
  balanceCents,
  buildStatement,
  creditCheck,
  dueDateFor,
  fromCents,
  invoiceStatus,
  invoiceTotals,
  nextInvoiceNumber,
  outstandingByInvoice,
  PAYMENT_METHODS,
  toCents,
  type InvoiceRow,
  type PaymentRow,
} from "@/lib/ledger";

const money = (d: { toString(): string }) => toCents(Number(d.toString()));

function guard(ctx: Ctx) {
  assertOrgType(ctx, "SUPPLIER", "STORE");
  assertCan(ctx, "customer.manage");
  assertVerified(ctx);
}
/** Voiding rewrites history, so it is limited to owners and admins. */
function assertOwnerOrAdmin(ctx: Ctx, what: string) {
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN")
    throw new AppError(`Only an owner or admin can ${what}.`, "FORBIDDEN");
}
const assertCanVoid = (ctx: Ctx) => assertOwnerOrAdmin(ctx, "void financial records");

function parse<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const r = schema.safeParse(raw);
  if (!r.success)
    throw new AppError("Please fix the highlighted fields.", "VALIDATION", fieldErrorsFrom(r.error));
  return r.data;
}

const optNum = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(min).max(max).optional());
const opt = (max: number) => z.string().trim().max(max).optional().default("");

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Enter the customer name").max(120),
  contactName: opt(80),
  phone: opt(30),
  email: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().email("Enter a valid email").max(120).optional()),
  city: opt(80),
  address: opt(300),
  taxNumber: opt(40),
  creditLimit: optNum(0, 1e9),
  paymentTermsDays: z.coerce.number().int("Whole days only").min(0).max(365).default(30),
  notes: opt(1000),
});

function customerData(d: z.infer<typeof customerSchema>) {
  return {
    name: d.name,
    contactName: d.contactName || null,
    phone: d.phone || null,
    email: d.email || null,
    city: d.city || null,
    address: d.address || null,
    taxNumber: d.taxNumber || null,
    creditLimit: d.creditLimit == null ? null : new Prisma.Decimal(d.creditLimit.toFixed(2)),
    paymentTermsDays: d.paymentTermsDays,
    notes: d.notes || null,
  };
}

const duplicate = (e: unknown) =>
  (e as { code?: string })?.code === "P2002"
    ? new AppError("You already have a customer with that name.", "CONFLICT", { name: "Already exists" })
    : e;

export async function createCustomer(ctx: Ctx, raw: unknown) {
  guard(ctx);
  const d = parse(customerSchema, raw);
  try {
    const c = await db.customer.create({ data: { orgId: ctx.orgId, ...customerData(d) } });
    await audit({ orgId: ctx.orgId, actorId: ctx.userId, action: "customer.create", entity: "Customer", entityId: c.id });
    return c;
  } catch (e) {
    throw duplicate(e);
  }
}

export async function updateCustomer(ctx: Ctx, id: string, raw: unknown) {
  guard(ctx);
  const d = parse(customerSchema, raw);
  try {
    const res = await db.customer.updateMany({ where: { id, orgId: ctx.orgId }, data: customerData(d) });
    if (res.count !== 1) throw new AppError("Customer not found", "NOT_FOUND");
  } catch (e) {
    throw duplicate(e);
  }
  await audit({ orgId: ctx.orgId, actorId: ctx.userId, action: "customer.update", entity: "Customer", entityId: id });
}

export async function setCustomerActive(ctx: Ctx, id: string, isActive: boolean) {
  guard(ctx);
  const res = await db.customer.updateMany({ where: { id, orgId: ctx.orgId }, data: { isActive } });
  if (res.count !== 1) throw new AppError("Customer not found", "NOT_FOUND");
}

const toInvoiceRow = (i: { id: string; number: string; issuedAt: Date; dueAt: Date; total: Prisma.Decimal; voidedAt: Date | null }): InvoiceRow => ({
  id: i.id,
  number: i.number,
  issuedAt: i.issuedAt,
  dueAt: i.dueAt,
  totalCents: money(i.total),
  voided: !!i.voidedAt,
});
const toPaymentRow = (p: { id: string; invoiceId: string | null; amount: Prisma.Decimal; receivedAt: Date; voidedAt: Date | null }): PaymentRow => ({
  id: p.id,
  invoiceId: p.invoiceId,
  amountCents: money(p.amount),
  receivedAt: p.receivedAt,
  voided: !!p.voidedAt,
});

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  isActive: boolean;
  balance: number;
  creditLimit: number | null;
  overLimit: boolean;
  overdue: number;
};

/** Customer book with live balances. Two queries for the whole org, grouped in memory. */
export async function listCustomers(ctx: Ctx, opts: { q?: string; owingOnly?: boolean } = {}): Promise<CustomerRow[]> {
  guard(ctx);
  const [customers, invoices, payments] = await Promise.all([
    db.customer.findMany({
      where: {
        orgId: ctx.orgId,
        ...(opts.q ? { OR: [{ name: { contains: opts.q, mode: "insensitive" } }, { phone: { contains: opts.q } }, { contactName: { contains: opts.q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { name: "asc" },
      take: 500,
    }),
    db.invoice.findMany({ where: { orgId: ctx.orgId, voidedAt: null }, select: { id: true, number: true, customerId: true, issuedAt: true, dueAt: true, total: true, voidedAt: true } }),
    db.customerPayment.findMany({ where: { orgId: ctx.orgId, voidedAt: null }, select: { id: true, customerId: true, invoiceId: true, amount: true, receivedAt: true, voidedAt: true } }),
  ]);
  const invBy = new Map<string, InvoiceRow[]>();
  for (const i of invoices) (invBy.get(i.customerId) ?? invBy.set(i.customerId, []).get(i.customerId)!).push(toInvoiceRow(i));
  const payBy = new Map<string, PaymentRow[]>();
  for (const p of payments) (payBy.get(p.customerId) ?? payBy.set(p.customerId, []).get(p.customerId)!).push(toPaymentRow(p));
  const now = new Date();
  const rows = customers.map((c): CustomerRow => {
    const inv = invBy.get(c.id) ?? [];
    const pay = payBy.get(c.id) ?? [];
    const bal = balanceCents(inv, pay);
    const limit = c.creditLimit == null ? null : money(c.creditLimit);
    const buckets = aging(inv, pay, now);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      city: c.city,
      isActive: c.isActive,
      balance: fromCents(bal),
      creditLimit: limit == null ? null : fromCents(limit),
      overLimit: limit != null && bal > limit,
      overdue: fromCents(buckets.slice(1).reduce((s, x) => s + x, 0)),
    };
  });
  return opts.owingOnly ? rows.filter((r) => r.balance > 0) : rows;
}

export async function getCustomerLedger(ctx: Ctx, id: string) {
  guard(ctx);
  const customer = await db.customer.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!customer) return null;
  const [invoices, payments] = await Promise.all([
    db.invoice.findMany({ where: { orgId: ctx.orgId, customerId: id }, orderBy: { issuedAt: "asc" } }),
    db.customerPayment.findMany({ where: { orgId: ctx.orgId, customerId: id }, orderBy: { receivedAt: "asc" } }),
  ]);
  const invRows = invoices.map(toInvoiceRow);
  const payRows = payments.map(toPaymentRow);
  const now = new Date();
  const outstanding = outstandingByInvoice(invRows, payRows);
  const limitCents = customer.creditLimit == null ? null : money(customer.creditLimit);
  const bal = balanceCents(invRows, payRows);
  const check = creditCheck(bal, limitCents, 0);
  return {
    customer,
    balance: fromCents(bal),
    creditLimit: limitCents == null ? null : fromCents(limitCents),
    available: check.availableCents == null ? null : fromCents(check.availableCents),
    aging: aging(invRows, payRows, now).map(fromCents),
    invoices: invoices.map((i, idx) => {
      const out = outstanding.get(i.id) ?? 0;
      return {
        id: i.id,
        number: i.number,
        issuedAt: i.issuedAt,
        dueAt: i.dueAt,
        total: Number(i.total.toString()),
        outstanding: fromCents(out),
        status: invoiceStatus(invRows[idx], out, now),
        reference: i.reference,
        description: i.description,
        voidReason: i.voidReason,
      };
    }),
    payments: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount.toString()),
      method: p.method,
      reference: p.reference,
      receivedAt: p.receivedAt,
      invoiceId: p.invoiceId,
      voided: !!p.voidedAt,
    })),
    statement: buildStatement(
      invoices.map((i, idx) => ({ ...invRows[idx], description: i.description ?? "Invoice" })),
      payments.map((p, idx) => ({ ...payRows[idx], ref: p.reference ?? "", method: p.method })),
    ),
  };
}

export const invoiceSchema = z.object({
  description: z.string().trim().min(2, "Describe what was supplied").max(300),
  reference: opt(80),
  subtotal: z.coerce.number().positive("Enter an amount above 0").max(1e9),
  vatPercent: z.coerce.number().min(0).max(100).default(5),
  issuedAt: z.string().optional().default(""),
  termsDays: optNum(0, 365),
  notes: opt(500),
  overrideCredit: z.coerce.boolean().optional().default(false),
});

/** Serializable, so two invoices raised at once cannot both slip under the limit or share a number. */
export async function createInvoice(ctx: Ctx, customerId: string, raw: unknown) {
  guard(ctx);
  const d = parse(invoiceSchema, raw);
  const issuedAt = d.issuedAt ? new Date(d.issuedAt) : new Date();
  if (Number.isNaN(issuedAt.getTime()) || issuedAt.getTime() > Date.now() + 86_400_000)
    throw new AppError("Enter a valid invoice date (not in the future).", "VALIDATION", { issuedAt: "Invalid date" });
  const { subtotalCents, vatCents, totalCents } = invoiceTotals(toCents(d.subtotal), d.vatPercent);

  const invoice = await db.$transaction(
    async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: customerId, orgId: ctx.orgId } });
      if (!customer) throw new AppError("Customer not found", "NOT_FOUND");
      if (!customer.isActive) throw new AppError("This customer is archived.", "FORBIDDEN");

      const [invs, pays] = await Promise.all([
        tx.invoice.findMany({ where: { orgId: ctx.orgId, customerId } , select: { id: true, number: true, issuedAt: true, dueAt: true, total: true, voidedAt: true } }),
        tx.customerPayment.findMany({ where: { orgId: ctx.orgId, customerId }, select: { id: true, invoiceId: true, amount: true, receivedAt: true, voidedAt: true } }),
      ]);
      const limit = customer.creditLimit == null ? null : money(customer.creditLimit);
      const check = creditCheck(balanceCents(invs.map(toInvoiceRow), pays.map(toPaymentRow)), limit, totalCents);
      let overridden = false;
      if (!check.ok) {
        if (!d.overrideCredit)
          throw new AppError(
            `This invoice would put ${customer.name} ${fromCents(check.overByCents).toFixed(2)} over their credit limit (${fromCents(limit!).toFixed(2)}). Record a payment first, or an owner/admin can override.`,
            "FORBIDDEN",
            { subtotal: "Over credit limit" },
          );
        assertOwnerOrAdmin(ctx, "override a credit limit");
        overridden = true;
      }

      const year = issuedAt.getUTCFullYear();
      const existing = await tx.invoice.findMany({ where: { orgId: ctx.orgId, number: { startsWith: `INV-${year}-` } }, select: { number: true } });
      const number = nextInvoiceNumber(existing.map((x) => x.number), year);
      const created = await tx.invoice.create({
        data: {
          orgId: ctx.orgId,
          customerId,
          number,
          reference: d.reference || null,
          description: d.description,
          issuedAt,
          dueAt: dueDateFor(issuedAt, d.termsDays ?? customer.paymentTermsDays),
          subtotal: new Prisma.Decimal(fromCents(subtotalCents).toFixed(2)),
          vatAmount: new Prisma.Decimal(fromCents(vatCents).toFixed(2)),
          total: new Prisma.Decimal(fromCents(totalCents).toFixed(2)),
          notes: d.notes || null,
          createdById: ctx.userId,
        },
      });
      return { created, overridden };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "invoice.create",
    entity: "Invoice",
    entityId: invoice.created.id,
    meta: { number: invoice.created.number, total: fromCents(totalCents), creditOverride: invoice.overridden || undefined },
  });
  return invoice.created;
}

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount above 0").max(1e9),
  method: z.enum(PAYMENT_METHODS, { message: "Choose a payment method" }),
  invoiceId: opt(60),
  reference: opt(80),
  note: opt(300),
  receivedAt: z.string().optional().default(""),
});

export async function recordPayment(ctx: Ctx, customerId: string, raw: unknown) {
  guard(ctx);
  const d = parse(paymentSchema, raw);
  const receivedAt = d.receivedAt ? new Date(d.receivedAt) : new Date();
  if (Number.isNaN(receivedAt.getTime()) || receivedAt.getTime() > Date.now() + 86_400_000)
    throw new AppError("Enter a valid payment date (not in the future).", "VALIDATION", { receivedAt: "Invalid date" });
  const amountCents = toCents(d.amount);

  const payment = await db.$transaction(
    async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: customerId, orgId: ctx.orgId }, select: { id: true } });
      if (!customer) throw new AppError("Customer not found", "NOT_FOUND");
      if (d.invoiceId) {
        const inv = await tx.invoice.findFirst({
          where: { id: d.invoiceId, orgId: ctx.orgId, customerId },
          include: { payments: { where: { voidedAt: null }, select: { amount: true } } },
        });
        if (!inv) throw new AppError("Invoice not found for this customer.", "NOT_FOUND", { invoiceId: "Not found" });
        if (inv.voidedAt) throw new AppError("That invoice is void.", "VALIDATION", { invoiceId: "Void invoice" });
        const owing = money(inv.total) - inv.payments.reduce((s, p) => s + money(p.amount), 0);
        if (amountCents > owing)
          throw new AppError(
            `That is more than the ${fromCents(Math.max(owing, 0)).toFixed(2)} still owing on ${inv.number}. Leave the invoice blank to record it as a payment on account.`,
            "VALIDATION",
            { amount: "More than owing" },
          );
      }
      return tx.customerPayment.create({
        data: {
          orgId: ctx.orgId,
          customerId,
          invoiceId: d.invoiceId || null,
          amount: new Prisma.Decimal(fromCents(amountCents).toFixed(2)),
          method: d.method,
          reference: d.reference || null,
          note: d.note || null,
          receivedAt,
          createdById: ctx.userId,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  await audit({ orgId: ctx.orgId, actorId: ctx.userId, action: "payment.record", entity: "CustomerPayment", entityId: payment.id, meta: { amount: d.amount, method: d.method } });
  return payment;
}

const reasonSchema = z.string().trim().min(3, "Give a short reason").max(200);

export async function voidInvoice(ctx: Ctx, invoiceId: string, rawReason: unknown) {
  guard(ctx);
  assertCanVoid(ctx);
  const reason = parse(z.object({ reason: reasonSchema }), { reason: rawReason }).reason;
  await db.$transaction(async (tx) => {
    const res = await tx.invoice.updateMany({ where: { id: invoiceId, orgId: ctx.orgId, voidedAt: null }, data: { voidedAt: new Date(), voidReason: reason } });
    if (res.count !== 1) throw new AppError("Invoice not found or already void.", "NOT_FOUND");
    // Payments that were allocated to it stay on the account as unallocated credit.
    await tx.customerPayment.updateMany({ where: { orgId: ctx.orgId, invoiceId }, data: { invoiceId: null } });
  });
  await audit({ orgId: ctx.orgId, actorId: ctx.userId, action: "invoice.void", entity: "Invoice", entityId: invoiceId, meta: { reason } });
}

export async function voidPayment(ctx: Ctx, paymentId: string) {
  guard(ctx);
  assertCanVoid(ctx);
  const res = await db.customerPayment.updateMany({ where: { id: paymentId, orgId: ctx.orgId, voidedAt: null }, data: { voidedAt: new Date() } });
  if (res.count !== 1) throw new AppError("Payment not found or already void.", "NOT_FOUND");
  await audit({ orgId: ctx.orgId, actorId: ctx.userId, action: "payment.void", entity: "CustomerPayment", entityId: paymentId });
}
