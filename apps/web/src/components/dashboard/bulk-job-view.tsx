"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { FIELDS } from "@/lib/bulk/fields";

type Progress = {
  id: string;
  status: string;
  mode: string;
  filename: string;
  totalRows: number;
  counts: Record<string, number>;
  message: string | null;
  done?: boolean;
  busy?: boolean;
};
type Issue = { field: string; message: string; fix?: string };
type Detail = {
  progress: Progress;
  headers: string[];
  problems: {
    rowNumber: number;
    status: string;
    raw: string[] | null;
    errors: Issue[] | null;
    message: string | null;
  }[];
  sample: {
    rowNumber: number;
    action: string | null;
    values: Record<string, string | number | boolean>;
    status: string;
  }[];
  warned: number;
  canRollback: boolean;
};

async function api<T>(id: string, body?: unknown, query = ""): Promise<T> {
  const res = await fetch(
    `/api/imports/${id}${query}`,
    body
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const n = (v: number | undefined) => (v ?? 0).toLocaleString("en");

const STATUS_LABEL: Record<string, string> = {
  UPLOADING: "Upload not finished",
  VALIDATING: "Checking rows",
  READY: "Ready to review",
  PROCESSING: "Importing",
  COMPLETED: "Completed",
  COMPLETED_WITH_ERRORS: "Completed with errors",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  ROLLING_BACK: "Rolling back",
  ROLLED_BACK: "Rolled back",
};

function pct(p: Progress): number {
  const c = p.counts;
  const total = Math.max(1, p.totalRows);
  if (p.status === "VALIDATING") return ((total - (c.PENDING ?? 0)) / total) * 100;
  if (p.status === "PROCESSING") {
    const done = (c.CREATED ?? 0) + (c.UPDATED ?? 0) + (c.FAILED ?? 0);
    return (done / Math.max(1, done + (c.VALID ?? 0))) * 100;
  }
  if (p.status === "ROLLING_BACK") {
    const left = (c.CREATED ?? 0) + (c.UPDATED ?? 0);
    const back = (c.ROLLED_BACK ?? 0) + (c.SKIPPED ?? 0);
    return (back / Math.max(1, back + left)) * 100;
  }
  return 100;
}

const label = (k: string) => FIELDS.find((f) => f.key === k)?.label ?? k;

export function BulkJobView({ id }: { id: string }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [acting, setActing] = useState(false);

  // Drives whatever the job needs next (validate / import / roll back) one bounded step at a time.
  // Every step is safe to repeat, so a refresh or a second tab simply carries on.
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        let p = await api<Progress>(id);
        for (;;) {
          if (dead) return;
          setProgress(p);
          const action =
            p.status === "VALIDATING"
              ? "validate"
              : p.status === "PROCESSING"
                ? "import"
                : p.status === "ROLLING_BACK"
                  ? "rollback-step"
                  : null;
          if (!action) break;
          const next = await api<Progress>(id, { action });
          if (next.busy) await sleep(1500);
          p = next.busy ? await api<Progress>(id) : next;
          // the step that finishes returns the final progress; loop once more to move on
          if (next.done && !next.busy) p = await api<Progress>(id);
        }
        const d = await api<Detail>(id, undefined, "?detail=1");
        if (!dead) {
          setDetail(d);
          setProgress(d.progress);
        }
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
    return () => {
      dead = true;
    };
  }, [id, nonce]);

  async function act(body: object) {
    setActing(true);
    setError("");
    try {
      await api(id, body);
      setDetail(null);
      setNonce((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setActing(false);
    }
  }

  if (!progress) return <p className="text-sm text-muted">{error || "Loading…"}</p>;
  const c = progress.counts;
  const running = ["VALIDATING", "PROCESSING", "ROLLING_BACK"].includes(progress.status);
  const tone =
    progress.status === "COMPLETED"
      ? "green"
      : progress.status.includes("ERRORS") || progress.status === "ROLLED_BACK"
        ? "amber"
        : running
          ? "blue"
          : "neutral";

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{progress.filename}</h2>
          <Badge tone={tone}>{STATUS_LABEL[progress.status] ?? progress.status}</Badge>
          <Badge>
            {progress.mode === "CREATE"
              ? "Add new"
              : progress.mode === "UPSERT"
                ? "Add or update"
                : "Update only"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted">{n(progress.totalRows)} rows in the file.</p>
        {running ? (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded bg-slate-100">
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${Math.round(pct(progress))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {progress.status === "VALIDATING"
                ? "Checking every row. You can leave this page; it continues in the background."
                : progress.status === "PROCESSING"
                  ? `Saved ${n((c.CREATED ?? 0) + (c.UPDATED ?? 0))} of ${n((c.CREATED ?? 0) + (c.UPDATED ?? 0) + (c.VALID ?? 0))} rows. You can leave this page; it continues in the background.`
                  : "Restoring your catalogue to how it was before this import."}
            </p>
          </div>
        ) : null}
        {progress.message && !running ? <p className="mt-3 text-sm">{progress.message}</p> : null}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          {[
            [
              "Valid",
              (c.VALID ?? 0) + (c.CREATED ?? 0) + (c.UPDATED ?? 0) + (c.ROLLED_BACK ?? 0),
              "text-emerald-700",
            ],
            ["Created", c.CREATED, ""],
            ["Updated", c.UPDATED, ""],
            ["Rejected", c.INVALID, "text-red-700"],
            ["Failed while saving", c.FAILED, "text-red-700"],
          ].map(([k, v, cls]) => (
            <div key={String(k)} className="rounded-lg border border-line p-3">
              <dt className="text-xs uppercase text-muted">{k}</dt>
              <dd className={`text-xl font-semibold ${cls}`}>{n(v as number)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {progress.status === "UPLOADING" ? (
        <Alert tone="info">
          This upload did not finish, so nothing was imported. Start a new upload from the bulk
          upload page.
        </Alert>
      ) : null}

      {progress.status === "READY" && detail ? (
        <Card>
          <h3 className="font-semibold">Review before importing</h3>
          <p className="mt-1 text-sm text-muted">
            {n(c.VALID)} rows are ready. {n(c.INVALID)} rows have problems and will be skipped
            {detail.warned ? `; ${n(detail.warned)} ready rows carry a note worth checking` : ""}.
            Nothing has been saved yet.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={acting || !c.VALID}
              onClick={() => void act({ action: "start", onErrors: "skip" })}
            >
              Import {n(c.VALID)} valid rows
            </Button>
            {c.INVALID ? (
              <Button
                variant="outline"
                disabled={acting}
                onClick={() => void act({ action: "start", onErrors: "block" })}
              >
                Import only if every row is valid
              </Button>
            ) : null}
            {c.INVALID ? (
              <a
                className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold hover:bg-surface"
                href={`/api/imports/${id}/errors`}
              >
                Download error report
              </a>
            ) : null}
            <Button
              variant="ghost"
              disabled={acting}
              onClick={() => void act({ action: "cancel" })}
            >
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {(progress.status === "COMPLETED" || progress.status === "COMPLETED_WITH_ERRORS") &&
      detail ? (
        <Card>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/products"
              className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              View products
            </Link>
            {(c.INVALID ?? 0) + (c.FAILED ?? 0) > 0 ? (
              <a
                className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold hover:bg-surface"
                href={`/api/imports/${id}/errors`}
              >
                Download error report
              </a>
            ) : null}
            {detail.canRollback ? (
              <Button
                variant="outline"
                disabled={acting}
                onClick={() => {
                  if (
                    window.confirm(
                      "Undo this import? Created products are removed (or deactivated if already used) and updated products are restored, unless you edited them since.",
                    )
                  )
                    void act({ action: "rollback" });
                }}
              >
                Roll back this import
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {detail && detail.problems.length ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line px-5 py-3">
            <h3 className="font-semibold">Rows that need attention</h3>
            <p className="text-xs text-muted">
              Showing the first {detail.problems.length}. The error report has all of them, with
              your original cells and how to fix each one.
            </p>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">Row</th>
                  <th className="px-4 py-2">Your data</th>
                  <th className="px-4 py-2">Problem</th>
                  <th className="px-4 py-2">How to fix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {detail.problems.map((r) => {
                  const errs =
                    r.errors ?? (r.message ? [{ field: "", message: r.message, fix: "" }] : []);
                  return (
                    <tr key={r.rowNumber} className="align-top">
                      <td className="px-4 py-2 whitespace-nowrap">{r.rowNumber}</td>
                      <td
                        className="max-w-56 truncate px-4 py-2 text-muted"
                        title={(r.raw ?? []).join(" | ")}
                      >
                        {(r.raw ?? []).filter(Boolean).slice(0, 4).join(" · ")}
                      </td>
                      <td className="px-4 py-2">
                        {errs.map((e, i) => (
                          <div key={i}>
                            {e.field ? (
                              <span className="font-medium">{label(e.field)}: </span>
                            ) : null}
                            {e.message}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-2 text-muted">
                        {errs
                          .map((e) => e.fix)
                          .filter(Boolean)
                          .join(" ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {detail && detail.sample.length ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line px-5 py-3">
            <h3 className="font-semibold">Sample of valid rows</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-2">Row</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {detail.sample.map((r) => (
                  <tr key={r.rowNumber}>
                    <td className="px-4 py-2">{r.rowNumber}</td>
                    <td className="px-4 py-2">{r.action === "UPDATE" ? "Update" : "Create"}</td>
                    <td className="px-4 py-2 text-muted">
                      {Object.entries(r.values)
                        .filter(
                          ([k]) => !["categoryId", "subcategoryId", "productTypeId"].includes(k),
                        )
                        .slice(0, 8)
                        .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
