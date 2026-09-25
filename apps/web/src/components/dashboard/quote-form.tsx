"use client";
import { useActionState } from "react";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import { submitQuoteAction, type ActionState } from "@/server/actions";

type Item = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  specification: string | null;
};
type Existing = {
  deliveryDays: number | null;
  deliveryCost: string;
  notes: string | null;
  items: Record<string, { unitPrice: string; quantityAvailable: string; minOrderQty: string }>;
} | null;

export function QuoteForm({
  rfqId,
  items,
  existing,
}: {
  rfqId: string;
  items: Item[];
  existing: Existing;
}) {
  const [state, action] = useActionState<ActionState, FormData>(submitQuoteAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="rfqId" value={rfqId} />
      <Card className="space-y-4">
        <h2 className="font-semibold">{existing ? "Update your quote" : "Your quote"}</h2>
        {items.map((it) => {
          const e = existing?.items[it.id];
          return (
            <div key={it.id} className="rounded-lg border border-line p-3">
              <input type="hidden" name="itemId" value={it.id} />
              <p className="text-sm font-medium">
                {it.name}{" "}
                <span className="font-normal text-muted">
                  — requested {it.quantity} {it.unit}
                  {it.specification ? ` · ${it.specification}` : ""}
                </span>
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <Field label={`Unit price / ${it.unit} (AED)`}>
                  <Input
                    name={`price_${it.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    defaultValue={e?.unitPrice}
                  />
                </Field>
                <Field label="Quantity available">
                  <Input
                    name={`qty_${it.id}`}
                    type="number"
                    step="any"
                    min="0"
                    required
                    defaultValue={e?.quantityAvailable ?? it.quantity}
                  />
                </Field>
                <Field label="Minimum order">
                  <Input
                    name={`moq_${it.id}`}
                    type="number"
                    step="any"
                    min="0"
                    defaultValue={e?.minOrderQty ?? "1"}
                  />
                </Field>
              </div>
            </div>
          );
        })}
        {fe(state, "items") ? (
          <p role="alert" className="text-xs text-red-600">
            {fe(state, "items")}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Delivery time (days)">
            <Input
              name="deliveryDays"
              type="number"
              min="0"
              defaultValue={existing?.deliveryDays ?? ""}
            />
          </Field>
          <Field label="Delivery cost (AED)">
            <Input
              name="deliveryCost"
              type="number"
              step="0.01"
              min="0"
              defaultValue={existing?.deliveryCost ?? "0"}
            />
          </Field>
          <Field label="Quote valid for (days)">
            <Input name="validDays" type="number" min="1" max="90" defaultValue="7" />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea name="notes" rows={3} defaultValue={existing?.notes ?? ""} />
        </Field>
      </Card>
      <FormMessage state={state} />
      <SubmitButton>{existing ? "Update quote" : "Send quote"}</SubmitButton>
    </form>
  );
}
