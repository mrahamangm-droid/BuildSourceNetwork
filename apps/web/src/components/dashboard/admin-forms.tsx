"use client";
import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import {
  reviewPlanRequestAction,
  reviewVerificationAction,
  revokeVerificationAction,
  saveSettingsAction,
  type ActionState,
} from "@/server/actions";

export function ReviewForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    reviewVerificationAction,
    {},
  );
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="requestId" value={requestId} />
      <Input
        name="note"
        placeholder="Note to the company (required when rejecting)"
        aria-label="Review note"
      />
      {fe(state, "note") ? <p className="text-xs text-red-600">{fe(state, "note")}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="APPROVE" size="sm" disabled={pending}>
          Approve
        </Button>
        <Button type="submit" name="decision" value="REJECT" size="sm" variant="danger" disabled={pending}>
          Reject
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function RevokeForm({ orgId }: { orgId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(revokeVerificationAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="orgId" value={orgId} />
      <Input name="note" placeholder="Reason" aria-label="Reason" className="h-8 w-40" />
      <SubmitButton size="sm" variant="outline" pending="…">
        Revoke
      </SubmitButton>
      {state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}

export function SettingsForm({ rows }: { rows: { key: string; label: string; value: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(saveSettingsAction, {});
  return (
    <form action={action} className="max-w-md space-y-4">
      {rows.map((r) => (
        <div key={r.key}>
          <label className="mb-1 block text-sm font-medium" htmlFor={r.key}>
            {r.label}
          </label>
          <Input id={r.key} name={r.key} defaultValue={r.value} inputMode="numeric" />
          {fe(state, r.key) ? <p className="mt-1 text-xs text-red-600">{fe(state, r.key)}</p> : null}
        </div>
      ))}
      <FormMessage state={state} />
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}

export function PlanReviewForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reviewPlanRequestAction, {});
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="requestId" value={requestId} />
      <Input name="paymentRef" placeholder="Payment or invoice reference (required to approve)" aria-label="Payment reference" />
      {fe(state, "paymentRef") ? <p className="text-xs text-red-600">{fe(state, "paymentRef")}</p> : null}
      <Input name="note" placeholder="Note to the company (required when rejecting)" aria-label="Review note" />
      {fe(state, "note") ? <p className="text-xs text-red-600">{fe(state, "note")}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="APPROVE" size="sm" disabled={pending}>
          Activate for 30 days
        </Button>
        <Button type="submit" name="decision" value="REJECT" size="sm" variant="danger" disabled={pending}>
          Reject
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
