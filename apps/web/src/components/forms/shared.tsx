"use client";

import { useFormStatus } from "react-dom";
import { useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import type { ActionState } from "@/server/actions";

export function SubmitButton({
  children,
  pending: label = "Saving…",
  ...props
}: React.ComponentProps<typeof Button> & { pending?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? label : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (state.ok && state.message) return <Alert tone="success">{state.message}</Alert>;
  return null;
}

export const fe = (state: ActionState, key: string) => state.fieldErrors?.[key];

/** Uploads an image to /api/upload and stores the resulting URL in a hidden input. */
export function ImageUpload({
  name,
  label,
  initial,
}: {
  name: string;
  label: string;
  initial?: string | null;
}) {
  const [url, setUrl] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setUrl(json.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-16 w-16 rounded-lg border border-line object-cover" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-line text-xs text-muted">
            None
          </div>
        )}
        <div className="flex flex-col items-start gap-1">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="text-sm"
            onChange={(e) => onFile(e.target.files?.[0])}
            aria-label={label}
          />
          <span className="text-xs text-muted">
            {busy ? "Uploading…" : "PNG, JPEG or WebP, up to 2 MB"}
          </span>
          {url ? (
            <button
              type="button"
              className="text-xs text-red-600 underline"
              onClick={() => setUrl("")}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {err ? (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {err}
        </p>
      ) : null}
      <input type="hidden" name={name} value={url} />
    </div>
  );
}
