"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { readZip } from "@/lib/bulk/zip";

type Match = {
  filename: string;
  status: "matched" | "unknown_sku" | "unsupported";
  productId?: string;
  productName?: string;
  sku?: string;
  kind?: "image" | "document";
  position?: number;
  docKind?: string;
};
type Entry = Match & {
  file: File;
  state: "ready" | "uploading" | "done" | "failed" | "skipped";
  note: string;
};

const IMG_MAX = 2 * 1024 * 1024;
const PDF_MAX = 4 * 1024 * 1024;
const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

/** Expands zip files into their images and PDFs; other files pass through. */
async function expand(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    if (!/\.zip$/i.test(f.name)) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      out.push(f.type ? f : new File([f], f.name, { type: MIME[ext] ?? "" }));
      continue;
    }
    const entries = await readZip(new Uint8Array(await f.arrayBuffer()), 500 * 1024 * 1024);
    for (const [name, bytes] of entries) {
      const base = name.split("/").pop() ?? name;
      const ext = base.split(".").pop()?.toLowerCase() ?? "";
      if (base.startsWith(".") || name.startsWith("__MACOSX") || !MIME[ext]) continue;
      out.push(new File([bytes as unknown as BlobPart], base, { type: MIME[ext] }));
    }
  }
  return out;
}

export function BulkMediaUploader() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(true);
  const [finished, setFinished] = useState(false);

  const patch = (i: number, p: Partial<Entry>) =>
    setEntries((all) => all.map((e, k) => (k === i ? { ...e, ...p } : e)));

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    setFinished(false);
    setBusy(true);
    try {
      const files = await expand([...list]);
      if (!files.length) throw new Error("No images or PDFs found in the selection.");
      const all: Entry[] = [];
      for (let i = 0; i < files.length; i += 500) {
        const slice = files.slice(i, i + 500);
        const m = await postJson<Match[]>("/api/products/media", {
          action: "match",
          filenames: slice.map((f) => f.name),
        });
        m.forEach((x, k) => {
          const file = slice[k]!;
          const tooBig =
            file.type === "application/pdf" ? file.size > PDF_MAX : file.size > IMG_MAX;
          all.push({
            ...x,
            file,
            state: x.status === "matched" && !tooBig ? "ready" : "skipped",
            note:
              x.status === "unknown_sku"
                ? `No product with SKU “${x.sku}”`
                : x.status === "unsupported"
                  ? "Not a JPG, PNG, WebP or PDF"
                  : tooBig
                    ? file.type === "application/pdf"
                      ? "PDF is over 4 MB"
                      : "Image is over 2 MB"
                    : "",
          });
        });
      }
      setEntries(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the files");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    setBusy(true);
    setError("");
    const todo = entries.map((e, i) => ({ e, i })).filter((x) => x.e.state === "ready");
    const uploaded: { i: number; url: string }[] = [];
    let next = 0;
    async function worker() {
      while (next < todo.length) {
        const { e, i } = todo[next++]!;
        patch(i, { state: "uploading" });
        try {
          const body = new FormData();
          body.append("file", e.file);
          let res: Response | null = null;
          for (let t = 0; t < 3; t++) {
            res = await fetch("/api/upload", { method: "POST", body }).catch(() => null);
            if (res && res.status < 500) break;
            await new Promise((r) => setTimeout(r, 700 * (t + 1)));
          }
          const data = (await res?.json().catch(() => ({}))) as { url?: string; error?: string };
          if (!res?.ok || !data.url) throw new Error(data.error ?? "Upload failed");
          uploaded.push({ i, url: data.url });
        } catch (err) {
          patch(i, { state: "failed", note: err instanceof Error ? err.message : "Upload failed" });
        }
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    // link in batches
    for (let k = 0; k < uploaded.length; k += 50) {
      const batch = uploaded.slice(k, k + 50);
      try {
        const res = await postJson<{ index: number; ok: boolean; message: string }[]>(
          "/api/products/media",
          {
            action: "attach",
            replace,
            items: batch.map(({ i, url }) => {
              const e = entries[i]!;
              return {
                productId: e.productId,
                kind: e.kind,
                url,
                position: Math.min(10, e.position ?? 1),
                name: e.file.name,
                docKind: e.docKind ?? "DATASHEET",
              };
            }),
          },
        );
        res.forEach((r) =>
          patch(batch[r.index]!.i, { state: r.ok ? "done" : "failed", note: r.message }),
        );
      } catch (err) {
        batch.forEach(({ i }) =>
          patch(i, {
            state: "failed",
            note: err instanceof Error ? err.message : "Could not link",
          }),
        );
      }
    }
    setBusy(false);
    setFinished(true);
  }

  const ready = entries.filter((e) => e.state === "ready").length;
  const done = entries.filter((e) => e.state === "done").length;
  const failed = entries.filter((e) => e.state === "failed").length;
  const skipped = entries.filter((e) => e.state === "skipped").length;

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="text-lg font-semibold">1. Choose photos and documents</h2>
        <p className="mt-1 text-sm text-muted">
          Name each file after the product SKU: <code>CEM-OPC-50.jpg</code> is its main photo,{" "}
          <code>CEM-OPC-50_2.jpg</code> the second photo, and <code>CEM-OPC-50_datasheet.pdf</code>,{" "}
          <code>_msds.pdf</code> or <code>_certificate.pdf</code> add documents. Select many files
          at once, or one .zip containing them. Photos up to 2 MB (JPG, PNG, WebP), PDFs up to 4 MB.
        </p>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf,.zip"
          aria-label="Choose photos, PDFs or a zip file"
          disabled={busy}
          onChange={(e) => void onFiles(e.target.files)}
          className="mt-3 text-sm"
        />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Replace a product&apos;s existing photo when a new one arrives for the same position
        </label>
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {entries.length ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <p className="text-sm">
              {entries.length.toLocaleString("en")} files: <b>{ready + done + failed}</b> matched to
              products, <b>{skipped}</b> skipped
              {finished ? `. ${done} linked, ${failed} failed.` : "."}
            </p>
            <Button disabled={busy || !ready} onClick={() => void run()}>
              {busy ? "Working…" : `Upload ${ready.toLocaleString("en")} files`}
            </Button>
          </div>
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">File</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">As</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.slice(0, 500).map((e, i) => (
                  <tr key={i}>
                    <td className="max-w-56 truncate px-4 py-2" title={e.filename}>
                      {e.filename}
                    </td>
                    <td className="px-4 py-2">
                      {e.productName ? `${e.productName} (${e.sku})` : "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-muted">
                      {e.kind === "image"
                        ? `Photo ${e.position}`
                        : e.kind === "document"
                          ? (e.docKind ?? "Document").toLowerCase()
                          : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        tone={
                          e.state === "done"
                            ? "green"
                            : e.state === "failed"
                              ? "red"
                              : e.state === "skipped"
                                ? "amber"
                                : e.state === "uploading"
                                  ? "blue"
                                  : "neutral"
                        }
                      >
                        {e.state === "ready"
                          ? "Ready"
                          : e.state === "uploading"
                            ? "Uploading"
                            : e.state === "done"
                              ? "Linked"
                              : e.state === "failed"
                                ? "Failed"
                                : "Skipped"}
                      </Badge>
                      {e.note ? <span className="ml-2 text-xs text-muted">{e.note}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entries.length > 500 ? (
              <p className="px-4 py-2 text-xs text-muted">
                Showing the first 500 of {entries.length.toLocaleString("en")}; all are processed.
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
