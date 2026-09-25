"use client";
import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { resendVerificationAction, type ActionState } from "@/server/actions";

export function VerifyBanner() {
  const [state, action, pending] = useActionState<ActionState>(resendVerificationAction, {});
  return (
    <Alert tone="info">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          Verify your email to publish products, request quotes and send quotes. Check your inbox
          for the link.
        </span>
        <form action={action}>
          <Button variant="outline" size="sm" type="submit" disabled={pending}>
            {pending ? "Sending…" : state.ok ? "Sent — check inbox" : "Resend email"}
          </Button>
        </form>
      </div>
      {state.error ? <p className="mt-1 text-red-700">{state.error}</p> : null}
    </Alert>
  );
}
