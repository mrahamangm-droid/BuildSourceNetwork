"use client";
import { useActionState } from "react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton } from "@/components/forms/shared";
import { REPORT_REASONS } from "@/lib/reviews";
import {
  replyReviewAction,
  reportReviewAction,
  toggleHelpfulAction,
  type ActionState,
} from "@/server/actions";

export function ReportReviewForm({ reviewId }: { reviewId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(reportReviewAction, {});
  if (state.ok) return <p className="text-xs text-muted">{state.message}</p>;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted hover:underline">Report</summary>
      <form action={action} className="mt-2 max-w-sm space-y-2">
        <input type="hidden" name="reviewId" value={reviewId} />
        <Select name="reason" defaultValue="" required aria-label="Reason">
          <option value="" disabled>
            Why are you reporting this?
          </option>
          {REPORT_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        <Input name="note" maxLength={300} placeholder="Details (optional)" aria-label="Details" />
        <FormMessage state={state} />
        <SubmitButton size="sm" variant="outline">
          Send report
        </SubmitButton>
      </form>
    </details>
  );
}

export function ReplyForm({
  kind,
  reviewId,
  productId,
  existing,
}: {
  kind: "PRODUCT" | "ORDER";
  reviewId: string;
  productId?: string;
  existing?: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(replyReviewAction, {});
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-brand-700 hover:underline">
        {existing ? "Edit your reply" : "Reply publicly"}
      </summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="reviewId" value={reviewId} />
        {productId ? <input type="hidden" name="productId" value={productId} /> : null}
        <Textarea name="text" rows={3} maxLength={1000} defaultValue={existing ?? ""} required />
        <FormMessage state={state} />
        <SubmitButton size="sm">Publish reply</SubmitButton>
      </form>
    </details>
  );
}

export function HelpfulButton({
  reviewId,
  productId,
  voted,
  count,
}: {
  reviewId: string;
  productId: string;
  voted: boolean;
  count: number;
}) {
  return (
    <form action={toggleHelpfulAction} className="inline">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="productId" value={productId} />
      <Button type="submit" size="sm" variant={voted ? "primary" : "outline"} aria-pressed={voted}>
        Helpful{count ? ` (${count})` : ""}
      </Button>
    </form>
  );
}
