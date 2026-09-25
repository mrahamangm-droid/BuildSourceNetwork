"use client";
import { useActionState } from "react";
import { Card, Field, Select, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import { submitReviewAction, type ActionState } from "@/server/actions";

export function ReviewForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(submitReviewAction, {});
  if (state.ok)
    return (
      <Card>
        <FormMessage state={state} />
      </Card>
    );
  return (
    <Card>
      <h2 className="font-semibold">Review this supplier</h2>
      <p className="mb-3 text-sm text-muted">Reviews are only possible after a completed order.</p>
      <form action={action} className="space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <Field label="Rating" error={fe(state, "rating")}>
          <Select name="rating" defaultValue="" required>
            <option value="" disabled>
              Choose…
            </option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)} ({n})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Comment (optional)">
          <Textarea name="comment" rows={3} maxLength={1000} />
        </Field>
        <FormMessage state={state} />
        <SubmitButton>Submit review</SubmitButton>
      </form>
    </Card>
  );
}
