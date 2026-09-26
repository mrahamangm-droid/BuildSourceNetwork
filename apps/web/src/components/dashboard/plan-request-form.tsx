"use client";
import { useActionState } from "react";
import { Card, Field, Select, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import { requestPlanAction, type ActionState } from "@/server/actions";

export function PlanRequestForm({
  plans,
  currentCode,
}: {
  plans: { code: string; name: string; priceMonthlyCents: number | null }[];
  currentCode: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(requestPlanAction, {});
  return (
    <Card>
      <h2 className="font-semibold">Request a plan</h2>
      <p className="mt-1 text-sm text-muted">
        Online payment is not connected yet. Send a request and our team will confirm payment
        details, then activate your plan for 30 days.
      </p>
      <form action={action} className="mt-3 grid gap-3">
        <Field label="Plan" error={fe(state, "planCode")}>
          <Select name="planCode" defaultValue={currentCode !== "FREE" ? currentCode : ""} required>
            <option value="" disabled>
              Choose…
            </option>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
                {p.priceMonthlyCents
                  ? ` — $${p.priceMonthlyCents / 100}/month`
                  : p.priceMonthlyCents === null
                    ? " — custom"
                    : ""}
                {p.code === currentCode ? " (renew)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note (optional)" error={fe(state, "note")}>
          <Textarea name="note" maxLength={500} rows={3} />
        </Field>
        <FormMessage state={state} />
        <SubmitButton>Send request</SubmitButton>
      </form>
    </Card>
  );
}
