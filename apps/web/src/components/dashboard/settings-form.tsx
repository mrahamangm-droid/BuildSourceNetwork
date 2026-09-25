"use client";
import { useActionState } from "react";
import { Card, Field, Input } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import { saveUserSettingsAction, type ActionState } from "@/server/actions";

export function SettingsForm({
  user,
}: {
  user: {
    name: string;
    email: string;
    phone: string | null;
    notifyEmail: boolean;
    notifyInApp: boolean;
  };
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveUserSettingsAction, {});
  return (
    <Card>
      <form action={action} className="space-y-4">
        <Field label="Name" error={fe(state, "name")}>
          <Input name="name" defaultValue={user.name} required />
        </Field>
        <Field label="Email" hint="Your login email cannot be changed here.">
          <Input value={user.email} disabled readOnly />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={user.phone ?? ""} autoComplete="tel" />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Notifications</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="notifyInApp" defaultChecked={user.notifyInApp} /> In-app
            notifications
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="notifyEmail" defaultChecked={user.notifyEmail} /> Email
            notifications
          </label>
        </fieldset>
        <FormMessage state={state} />
        <SubmitButton>Save settings</SubmitButton>
      </form>
    </Card>
  );
}
