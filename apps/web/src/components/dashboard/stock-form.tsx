"use client";
import { useActionState } from "react";
import { Card, Field, Input, Select } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import { stockMovementAction, type ActionState } from "@/server/actions";

const KINDS = [
  { value: "RECEIPT", label: "Receive stock (purchase / delivery in)" },
  { value: "ISSUE", label: "Issue stock (sale / delivery out)" },
  { value: "ADJUSTMENT", label: "Stock take (set counted quantity)" },
  { value: "RESERVE", label: "Reserve for an order" },
  { value: "RELEASE", label: "Release a reservation" },
];

export function StockForm({ products }: { products: { id: string; name: string; unit: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(stockMovementAction, {});
  return (
    <Card>
      <h2 className="font-semibold">Record a stock movement</h2>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Product" error={fe(state, "productId")}>
          <Select name="productId" defaultValue="" required>
            <option value="" disabled>
              Choose…
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.unit})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="What happened?">
          <Select name="kind" defaultValue="RECEIPT">
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantity" error={fe(state, "quantity")}>
          <Input name="quantity" type="number" inputMode="decimal" step="0.001" min="0" required />
        </Field>
        <Field label="Unit cost (receipts, optional)" error={fe(state, "unitCost")}>
          <Input name="unitCost" type="number" inputMode="decimal" step="0.01" min="0" />
        </Field>
        <Field label="Reference (PO, invoice, order no.)" error={fe(state, "reference")}>
          <Input name="reference" maxLength={120} />
        </Field>
        <Field label="Note" error={fe(state, "note")}>
          <Input name="note" maxLength={500} />
        </Field>
        <div className="sm:col-span-2">
          <FormMessage state={state} />
          <SubmitButton>Save movement</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
