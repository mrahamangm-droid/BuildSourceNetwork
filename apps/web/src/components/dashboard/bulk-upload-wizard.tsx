"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card, Input, Select } from "@/components/ui";
import { FIELDS, type FieldKey } from "@/lib/bulk/fields";
import { autoMapColumns, detectHeaderRow, type ColumnMap } from "@/lib/bulk/mapping";
import { pickSheet, readSpreadsheetFile, type ParsedFile } from "@/lib/bulk/read-file";

type Mode = "CREATE" | "UPSERT" | "UPDATE";
const MODES: { value: Mode; title: string; text: string }[] = [
  {
    value: "CREATE",
    title: "Add new products",
    text: "Rows whose SKU already exists are rejected, so nothing is duplicated.",
  },
  {
    value: "UPSERT",
    title: "Add new and update existing",
    text: "Rows are matched by SKU: found means update, not found means create.",
  },
  {
    value: "UPDATE",
    title: "Update existing only",
    text: "Quick price, stock or MOQ changes. Only the columns you map are changed; blank cells change nothing.",
  },
];

function downloadTemplate() {
  const a = document.createElement("a");
  a.href = "/api/imports/template";
  a.download = "bsn-product-import-template.xlsx";
  a.click();
}

async function call(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as Record<string, unknown>;
}
async function callRetry(url: string, body: unknown, tries = 3) {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await call(url, body);
    } catch (e) {
      last = e;
      // 4xx answers are final; only network/server hiccups are worth retrying
      if (e instanceof Error && !/failed|network|wrong|fetch/i.test(e.message)) break;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw last;
}

export function BulkUploadWizard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("CREATE");
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(1); // 1-based
  const [map, setMap] = useState<ColumnMap>({});
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(
    null,
  );

  const sheet = file?.sheets[sheetIdx];
  const headers = useMemo(() => {
    const row = sheet?.rows[headerRow - 1] ?? [];
    const width = Math.max(
      row.length,
      ...(sheet?.rows.slice(headerRow, headerRow + 200) ?? []).map((r) => r.length),
      1,
    );
    return Array.from({ length: Math.min(width, 120) }, (_, i) => row[i] ?? "");
  }, [sheet, headerRow]);
  const dataRows = sheet ? sheet.rows.length - headerRow : 0;

  function load(parsed: ParsedFile, idx: number) {
    const rows = parsed.sheets[idx]!.rows;
    const h = detectHeaderRow(rows);
    setSheetIdx(idx);
    setHeaderRow(h + 1);
    setMap(autoMapColumns(rows[h] ?? []));
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError("");
    setReading(true);
    try {
      const parsed = await readSpreadsheetFile(f);
      setFile(parsed);
      load(parsed, pickSheet(parsed.sheets));
    } catch (e) {
      setFile(null);
      setError(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setReading(false);
    }
  }

  function changeHeader(n: number) {
    if (!sheet) return;
    const v = Math.max(1, Math.min(n || 1, sheet.rows.length));
    setHeaderRow(v);
    setMap(autoMapColumns(sheet.rows[v - 1] ?? []));
  }

  const requiredKeys = FIELDS.filter((f) => f.required).map((f) => f.key);
  const missing =
    mode === "UPDATE"
      ? map.sku === undefined
        ? (["sku"] as FieldKey[])
        : []
      : [...requiredKeys, ...(mode === "UPSERT" ? (["sku"] as FieldKey[]) : [])].filter(
          (k) => map[k] === undefined,
        );
  const mappedOthers = Object.keys(map).filter((k) => k !== "sku").length;
  const canStart =
    !!sheet &&
    dataRows > 0 &&
    !missing.length &&
    (mode !== "UPDATE" || mappedOthers > 0) &&
    !progress;

  function setField(key: FieldKey, v: string) {
    setMap((m) => {
      const next = { ...m };
      if (v === "") delete next[key];
      else next[key] = Number(v);
      return next;
    });
  }

  async function start() {
    if (!sheet || !file) return;
    setError("");
    let jobId = "";
    try {
      const rows: { n: number; c: string[] }[] = [];
      for (let i = headerRow; i < sheet.rows.length; i++) {
        const r = sheet.rows[i]!;
        if (r.some((c) => c && c.trim())) rows.push({ n: i + 1, c: r.slice(0, headers.length) });
      }
      if (!rows.length) throw new Error("There are no data rows below the header row.");
      setProgress({ label: "Preparing", done: 0, total: rows.length });
      const created = await call("/api/imports", {
        filename: file.filename,
        headers,
        columnMap: map,
        mode,
        totalRows: rows.length,
      });
      jobId = String(created.id);
      // Chunks stay well under the 4.5 MB request limit: at most 1,500 rows or ~1 MB of text.
      let i = 0;
      while (i < rows.length) {
        let size = 0;
        const chunk: typeof rows = [];
        while (i < rows.length && chunk.length < 1500 && size < 1_000_000) {
          size += rows[i]!.c.reduce((s, c) => s + c.length + 4, 12);
          chunk.push(rows[i++]!);
        }
        await callRetry(`/api/imports/${jobId}`, { action: "rows", rows: chunk });
        setProgress({ label: "Uploading rows", done: i, total: rows.length });
      }
      await callRetry(`/api/imports/${jobId}`, { action: "finish" });
      router.push(`/dashboard/products/bulk/${jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setProgress(null);
      if (jobId) await call(`/api/imports/${jobId}`, { action: "cancel" }).catch(() => {});
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-semibold">1. What do you want to do?</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`cursor-pointer rounded-lg border p-3 text-sm ${mode === m.value ? "border-brand-600 bg-brand-50" : "border-line"}`}
            >
              <input
                type="radio"
                name="mode"
                className="sr-only"
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
              />
              <span className="block font-semibold">{m.title}</span>
              <span className="mt-1 block text-muted">{m.text}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">2. Choose your file</h2>
        <p className="mt-1 text-sm text-muted">
          Excel (.xlsx) or CSV, up to 100,000 rows. Thousands separators, currency symbols and
          quantities like 1,000,000 are understood. Start from our template to get drop-downs for
          category, subcategory, product type and unit.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => downloadTemplate()}>
            Download Excel template
          </Button>
          <input
            type="file"
            accept=".xlsx,.xlsm,.csv,.tsv,.txt"
            aria-label="Choose spreadsheet file"
            disabled={!!progress}
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="text-sm"
          />
          {reading ? <span className="text-sm text-muted">Reading file…</span> : null}
        </div>
      </Card>

      {file && sheet ? (
        <Card>
          <h2 className="text-lg font-semibold">3. Check the column matching</h2>
          <p className="mt-1 text-sm text-muted">
            {file.filename}: {dataRows.toLocaleString("en")} data rows. We matched the columns
            automatically; change any that look wrong.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {file.sheets.length > 1 ? (
              <label className="flex items-center gap-2">
                Sheet
                <Select
                  value={sheetIdx}
                  onChange={(e) => load(file, Number(e.target.value))}
                  className="h-9 w-48"
                >
                  {file.sheets.map((s, i) => (
                    <option key={s.name} value={i}>
                      {s.name} ({s.rows.length.toLocaleString("en")} rows)
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
            <label className="flex items-center gap-2">
              Header row
              <Input
                type="number"
                min={1}
                value={headerRow}
                onChange={(e) => changeHeader(Number(e.target.value))}
                className="h-9 w-20"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-x-6 gap-y-2 md:grid-cols-2">
            {FIELDS.map((f) => {
              const need = f.required || (f.key === "sku" && mode !== "CREATE");
              const idx = map[f.key];
              const sample =
                idx === undefined
                  ? ""
                  : sheet.rows
                      .slice(headerRow, headerRow + 3)
                      .map((r) => r[idx])
                      .filter(Boolean)
                      .join(" · ");
              return (
                <div key={f.key} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0">
                    {f.label}
                    {need ? <span className="text-red-600"> *</span> : null}
                  </span>
                  <Select
                    value={idx === undefined ? "" : String(idx)}
                    onChange={(e) => setField(f.key, e.target.value)}
                    aria-label={`Column for ${f.label}`}
                    className="h-9"
                  >
                    <option value="">{need ? "Choose column…" : "Not in my file"}</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </Select>
                  <span
                    className="hidden max-w-40 truncate text-xs text-muted lg:inline"
                    title={sample}
                  >
                    {sample}
                  </span>
                </div>
              );
            })}
          </div>
          {missing.length ? (
            <div className="mt-4">
              <Alert tone="error">
                Still needed:{" "}
                {missing.map((k) => FIELDS.find((f) => f.key === k)!.label).join(", ")}.
              </Alert>
            </div>
          ) : mode === "UPDATE" && !mappedOthers ? (
            <div className="mt-4">
              <Alert tone="error">Match at least one column to update besides SKU.</Alert>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
              <Badge tone="green">Ready</Badge>
              {Object.keys(map).length} columns matched. Nothing is saved until you review the
              results.
            </div>
          )}
        </Card>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}
      {progress ? (
        <Card>
          <p className="text-sm font-medium">
            {progress.label} {progress.done.toLocaleString("en")} /{" "}
            {progress.total.toLocaleString("en")}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{
                width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">Keep this tab open until the upload finishes.</p>
        </Card>
      ) : null}
      {file ? (
        <Button size="lg" disabled={!canStart} onClick={() => void start()}>
          Upload and check {dataRows.toLocaleString("en")} rows
        </Button>
      ) : null}
    </div>
  );
}
