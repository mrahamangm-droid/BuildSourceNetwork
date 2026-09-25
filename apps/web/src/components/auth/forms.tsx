"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Field, Input, Select } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  type ActionState,
} from "@/server/actions";
import { ORG_TYPES, ORG_TYPE_DESCRIPTION, ORG_TYPE_LABEL, type OrgType } from "@bmn/config";

const init: ActionState = {};

export function LoginForm({ next, reset }: { next?: string; reset?: boolean }) {
  const [state, action] = useActionState(loginAction, init);
  return (
    <form action={action} className="space-y-4">
      {reset ? (
        <Alert tone="success">Password updated. Sign in with your new password.</Alert>
      ) : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pending="Signing in…">
        Sign in
      </SubmitButton>
      <p className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-brand-700 hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ defaultType }: { defaultType?: OrgType }) {
  const [state, action] = useActionState(registerAction, init);
  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">I am a…</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ORG_TYPES.map((t) => (
            <label
              key={t}
              className="flex cursor-pointer gap-3 rounded-lg border border-line p-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50"
            >
              <input
                type="radio"
                name="orgType"
                value={t}
                defaultChecked={t === (defaultType ?? "SUPPLIER")}
                className="mt-1"
                required
              />
              <span>
                <span className="block text-sm font-semibold">{ORG_TYPE_LABEL[t]}</span>
                <span className="block text-xs text-muted">{ORG_TYPE_DESCRIPTION[t]}</span>
              </span>
            </label>
          ))}
        </div>
        {fe(state, "orgType") ? (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {fe(state, "orgType")}
          </p>
        ) : null}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" error={fe(state, "orgName")}>
          <Input name="orgName" required autoComplete="organization" />
        </Field>
        <Field label="City" error={fe(state, "city")}>
          <Input name="city" required autoComplete="address-level2" placeholder="e.g. Sharjah" />
        </Field>
        <Field label="Your name" error={fe(state, "name")}>
          <Input name="name" required autoComplete="name" />
        </Field>
        <Field label="Work email" error={fe(state, "email")}>
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
      </div>
      <Field
        label="Password"
        hint="At least 10 characters, with letters and a number"
        error={fe(state, "password")}
      >
        <Input
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pending="Creating account…">
        Create free account
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, init);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <FormMessage state={state} />
      {state.devLink ? (
        <Alert>
          Dev only:{" "}
          <Link className="underline" href={state.devLink}>
            open reset link
          </Link>
        </Alert>
      ) : null}
      <SubmitButton className="w-full" pending="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, init);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field
        label="New password"
        hint="At least 10 characters, with letters and a number"
        error={fe(state, "password")}
      >
        <Input
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Update password</SubmitButton>
    </form>
  );
}

export { Select };
