"use client";
import { useActionState } from "react";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import {
  createInvoiceAction,
  recordPaymentAction,
  saveCustomerAction,
  voidInvoiceAction,
  type ActionState,
} from "@/server/actions";
import { PAYMENT_METHODS } from "@/lib/ledger";

type CustomerDefaults = {
  id?: string;
  name?: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  creditLimit?: number | null;
  paymentTermsDays?: number;
  notes?: string | null;
};

export function CustomerForm({ c }: { c?: CustomerDefaults }) {
  const [state, action] = useActionState<ActionState, FormData>(saveCustomerAction, {});
  return (
    <Card>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        {c?.id ? <input type="hidden" name="id" value={c.id} /> : null}
        <Field label="Customer name" error={fe(state, "name")}>
          <Input name="name" required maxLength={120} defaultValue={c?.name ?? ""} />
        </Field>
        <Field label="Contact person" error={fe(state, "contactName")}>
          <Input name="contactName" maxLength={80} defaultValue={c?.contactName ?? ""} />
        </Field>
        <Field label="Phone" error={fe(state, "phone")}>
          <Input name="phone" type="tel" maxLength={30} defaultValue={c?.phone ?? ""} />
        </Field>
        <Field label="Email" error={fe(state, "email")}>
          <Input name="email" type="email" maxLength={120} defaultValue={c?.email ?? ""} />
        </Field>
        <Field label="City" error={fe(state, "city")}>
          <Input name="city" maxLength={80} defaultValue={c?.city ?? ""} />
        </Field>
        <Field label="Tax registration no." error={fe(state, "taxNumber")}>
          <Input name="taxNumber" maxLength={40} defaultValue={c?.taxNumber ?? ""} />
        </Field>
        <Field label="Credit limit (leave empty for no limit)" error={fe(state, "creditLimit")}>
          <Input name="creditLimit" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={c?.creditLimit ?? ""} />
        </Field>
        <Field label="Payment terms (days)" error={fe(state, "paymentTermsDays")}>
          <Input name="paymentTermsDays" type="number" min="0" max="365" step="1" defaultValue={c?.paymentTermsDays ?? 30} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address" error={fe(state, "address")}>
            <Input name="address" maxLength={300} defaultValue={c?.address ?? ""} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notes" error={fe(state, "notes")}>
            <Textarea name="notes" rows={2} maxLength={1000} defaultValue={c?.notes ?? ""} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <FormMessage state={state} />
          <SubmitButton>{c?.id ? "Save customer" : "Add customer"}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function InvoiceForm({
  customerId,
  defaultTerms,
  canOverride,
}: {
  customerId: string;
  defaultTerms: number;
  canOverride: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(createInvoiceAction, {});
  const overLimit = !!state.error && /credit limit/i.test(state.error);
  return (
    <Card>
      <h2 className="font-semibold">New invoice</h2>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="customerId" value={customerId} />
        <div className="sm:col-span-2">
          <Field label="What was supplied" error={fe(state, "description")}>
            <Input name="description" required maxLength={300} placeholder="e.g. 200 bags cement, delivered to site" />
          </Field>
        </div>
        <Field label="Amount before VAT" error={fe(state, "subtotal")}>
          <Input name="subtotal" type="number" inputMode="decimal" min="0.01" step="0.01" required />
        </Field>
        <Field label="VAT %" error={fe(state, "vatPercent")}>
          <Input name="vatPercent" type="number" min="0" max="100" step="0.01" defaultValue={5} />
        </Field>
        <Field label="Invoice date (optional)" error={fe(state, "issuedAt")}>
          <Input name="issuedAt" type="date" />
        </Field>
        <Field label="Payment terms (days)" error={fe(state, "termsDays")}>
          <Input name="termsDays" type="number" min="0" max="365" step="1" defaultValue={defaultTerms} />
        </Field>
        <Field label="Your reference (order / PO no.)" error={fe(state, "reference")}>
          <Input name="reference" maxLength={80} />
        </Field>
        <Field label="Notes" error={fe(state, "notes")}>
          <Input name="notes" maxLength={500} />
        </Field>
        {canOverride && overLimit ? (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="overrideCredit" /> Override the credit limit for this invoice
          </label>
        ) : null}
        <div className="sm:col-span-2">
          <FormMessage state={state} />
          <SubmitButton>Create invoice</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function PaymentForm({
  customerId,
  openInvoices,
}: {
  customerId: string;
  openInvoices: { id: string; number: string; outstanding: number }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(recordPaymentAction, {});
  return (
    <Card>
      <h2 className="font-semibold">Record a payment</h2>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="customerId" value={customerId} />
        <Field label="Amount received" error={fe(state, "amount")}>
          <Input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" required />
        </Field>
        <Field label="Method" error={fe(state, "method")}>
          <Select name="method" defaultValue="BANK_TRANSFER">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Apply to invoice (optional)" error={fe(state, "invoiceId")}>
          <Select name="invoiceId" defaultValue="">
            <option value="">On account (oldest first)</option>
            {openInvoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.number} · {i.outstanding.toFixed(2)} owing
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date received (optional)" error={fe(state, "receivedAt")}>
          <Input name="receivedAt" type="date" />
        </Field>
        <Field label="Reference (cheque / transfer no.)" error={fe(state, "reference")}>
          <Input name="reference" maxLength={80} />
        </Field>
        <Field label="Note" error={fe(state, "note")}>
          <Input name="note" maxLength={300} />
        </Field>
        <div className="sm:col-span-2">
          <FormMessage state={state} />
          <SubmitButton>Record payment</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function VoidInvoiceForm({ customerId, invoiceId }: { customerId: string; invoiceId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(voidInvoiceAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input name="reason" required minLength={3} maxLength={200} placeholder="Reason for voiding" className="h-8 rounded-lg border border-line px-2 text-xs" />
      <SubmitButton>Void</SubmitButton>
      {state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}
