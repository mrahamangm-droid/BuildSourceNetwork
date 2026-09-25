"use client";
import { useActionState } from "react";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { FormMessage, ImageUpload, SubmitButton, fe } from "@/components/forms/shared";
import { submitVerificationAction, type ActionState } from "@/server/actions";

export function VerificationForm({ defaultName }: { defaultName: string }) {
  const [state, action] = useActionState<ActionState, FormData>(submitVerificationAction, {});
  return (
    <form action={action} className="space-y-4">
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registered company name" error={fe(state, "legalName")}>
            <Input name="legalName" defaultValue={defaultName} required />
          </Field>
          <Field label="Trade licence number" error={fe(state, "licenseNumber")}>
            <Input name="licenseNumber" required />
          </Field>
          <Field label="Issuing authority" hint="e.g. Sharjah Economic Development Department">
            <Input name="licenseAuthority" />
          </Field>
          <Field label="Tax registration number (optional)" error={fe(state, "taxNumber")}>
            <Input name="taxNumber" />
          </Field>
        </div>
        <ImageUpload name="licenseDocUrl" label="Trade licence (photo or scan, PNG/JPEG/WebP)" />
        <Field label="Notes for the reviewer (optional)">
          <Textarea name="notes" rows={3} />
        </Field>
      </Card>
      <FormMessage state={state} />
      <SubmitButton pending="Submitting…">Submit for verification</SubmitButton>
    </form>
  );
}
