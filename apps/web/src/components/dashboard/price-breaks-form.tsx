"use client";
import { useActionState } from "react";
import { Card, Field, Input } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import { savePriceBreaksAction, type ActionState } from "@/server/actions";

const SLOTS = 6;

export function PriceBreaksForm({
  productId,
  unit,
  currency,
  basePrice,
  minOrderQty,
  breaks,
}: {
  productId: string;
  unit: string;
  currency: string;
  basePrice: string;
  minOrderQty: string;
  breaks: { minQty: string; price: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(savePriceBreaksAction, {});
  return (
    <Card>
      <p className="text-sm text-muted">
        Base price {basePrice} {currency} per {unit}, minimum order {minOrderQty}. Each break applies from its
        quantity upward and must be cheaper than the tier before it. Leave a row empty to skip it; save with all
        rows empty to remove volume pricing.
      </p>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="productId" value={productId} />
        {Array.from({ length: SLOTS }, (_, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-2">
            <Field label={`Break ${i + 1}: from quantity (${unit})`} error={fe(state, `minQty_${i}`)}>
              <Input
                name={`minQty_${i}`}
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                defaultValue={breaks[i]?.minQty ?? ""}
              />
            </Field>
            <Field label={`Price per ${unit} (${currency})`} error={fe(state, `price_${i}`)}>
              <Input
                name={`price_${i}`}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                defaultValue={breaks[i]?.price ?? ""}
              />
            </Field>
          </div>
        ))}
        <FormMessage state={state} />
        <SubmitButton>Save price breaks</SubmitButton>
      </form>
    </Card>
  );
}
