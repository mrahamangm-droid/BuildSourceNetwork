"use client";
import { useActionState } from "react";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { FormMessage, ImageUpload, SubmitButton, fe } from "@/components/forms/shared";
import { StarInput } from "@/components/forms/star-input";
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
          <StarInput name="rating" />
        </Field>
        <Field label="Title (optional)" error={fe(state, "title")}>
          <Input name="title" maxLength={100} />
        </Field>
        <Field label="Comment (optional)" error={fe(state, "comment")}>
          <Textarea name="comment" rows={3} maxLength={1000} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <ImageUpload key={i} name={`photo${i}`} label={`Photo ${i} (optional)`} />
          ))}
        </div>
        <FormMessage state={state} />
        <SubmitButton>Submit review</SubmitButton>
      </form>
    </Card>
  );
}
