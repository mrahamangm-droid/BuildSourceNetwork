import { toCsv, type Grid } from "./csv";
import type { RowIssue } from "./validate";

export type ReportRow = {
  /** 1-based row number in the uploaded file (header counts as row 1 for CSV/XLSX alike). */
  rowNumber: number;
  cells: string[];
  errors: RowIssue[];
  warnings?: RowIssue[];
};

/**
 * The downloadable error report: every rejected row with its ORIGINAL cells followed by what is
 * wrong and how to fix it, so the supplier can correct the file and upload just these rows again.
 */
export function buildErrorReport(headers: string[], rows: ReportRow[]): string {
  const out: Grid = [["Row", ...headers, "Problem", "Column", "How to fix"]];
  for (const r of rows) {
    const issues = r.errors.length ? r.errors : (r.warnings ?? []);
    out.push([
      String(r.rowNumber),
      ...headers.map((_, i) => r.cells[i] ?? ""),
      issues.map((e) => e.message).join(" | "),
      [...new Set(issues.map((e) => e.field))].join(", "),
      issues
        .map((e) => e.fix ?? "")
        .filter(Boolean)
        .join(" | "),
    ]);
  }
  return toCsv(out, { bom: true });
}
