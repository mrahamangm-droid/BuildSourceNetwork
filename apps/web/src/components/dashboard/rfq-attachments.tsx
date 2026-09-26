"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/components/ui";
import { removeRfqAttachmentAction } from "@/server/actions";
import { ALLOWED_EXTENSIONS, MAX_ATTACHMENTS_PER_RFQ, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";

type Att = { id: string; filename: string; sizeBytes: number };

const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** `canEdit` = buyer of an open RFQ. Suppliers get a read-only list of download links. */
export function RfqAttachments({
  rfqId,
  files,
  canEdit,
}: {
  rfqId: string;
  files: Att[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit && files.length === 0) return null;

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_ATTACHMENT_BYTES) return setError("Each file must be under 4 MB.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("rfqId", rfqId);
      fd.set("file", file);
      const res = await fetch("/api/rfq-attachments", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error ?? "Upload failed");
      else router.refresh();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Card className="text-sm">
      <h2 className="font-semibold">Attachments</h2>
      <p className="mt-1 text-xs text-muted">
        Drawings and specifications are private: only you and the suppliers this request was sent to
        can open them.
      </p>
      {files.length ? (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <a
                className="min-w-0 truncate text-brand-700 hover:underline"
                href={`/api/rfq-attachments/${f.id}`}
                download
              >
                {f.filename}
              </a>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted">{size(f.sizeBytes)}</span>
                {canEdit ? (
                  <form action={removeRfqAttachmentAction}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="rfqId" value={rfqId} />
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-muted">No files attached.</p>
      )}
      {canEdit && files.length < MAX_ATTACHMENTS_PER_RFQ ? (
        <div className="mt-3">
          <input
            ref={input}
            type="file"
            className="sr-only"
            id="rfq-file"
            accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")}
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <label
            htmlFor="rfq-file"
            className={`inline-block cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface ${busy ? "opacity-50" : ""}`}
          >
            {busy ? "Uploading…" : "Add a file"}
          </label>
          <span className="ml-2 text-xs text-muted">
            PDF, images, XLSX, DOCX, DWG · max 4 MB · up to {MAX_ATTACHMENTS_PER_RFQ} files
          </span>
        </div>
      ) : null}
      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
    </Card>
  );
}
