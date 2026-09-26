"use client";
import { useActionState } from "react";
import { Field, Input, Textarea } from "@/components/ui";
import { FormMessage, ImageUpload, SubmitButton, fe } from "@/components/forms/shared";
import { StarInput } from "@/components/forms/star-input";
import { saveProductReviewAction, type ActionState } from "@/server/actions";

export function ProductReviewForm({
  productId,
  existing,
}: {
  productId: string;
  existing?: { rating: number; title: string | null; body: string | null; photos: string[] };
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveProductReviewAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <Field label="Your rating" error={fe(state, "rating")}>
        <StarInput name="rating" defaultValue={existing?.rating} />
      </Field>
      <Field label="Title (optional)" error={fe(state, "title")}>
        <Input name="title" maxLength={100} defaultValue={existing?.title ?? ""} />
      </Field>
      <Field
        label="Your review"
        hint="What was it like to use? Quality, delivery, value. No links or contact details."
        error={fe(state, "body")}
      >
        <Textarea name="body" rows={4} maxLength={2000} defaultValue={existing?.body ?? ""} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <ImageUpload
            key={i}
            name={`photo${i + 1}`}
            label={`Photo ${i + 1} (optional)`}
            initial={existing?.photos[i]}
          />
        ))}
      </div>
      <FormMessage state={state} />
      <SubmitButton>{existing ? "Update review" : "Publish review"}</SubmitButton>
    </form>
  );
}
