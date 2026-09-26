/**
 * BOQ / material-list import. Turns a pasted list or an uploaded CSV/TSV/TXT into structured lines
 * for the user to review. Deterministic (no AI, no cost) and defensive: every value is trimmed,
 * clamped and validated, and lines that cannot be understood are reported, never guessed.
 */
import { z } from "zod";
import { matchUnitCode } from "./boq-rfq";

export const IMPORT_MAX_LINES = 200;
export const IMPORT_MAX_CHARS = 200_000;

export type ImportLine = {
  section: string;
  description: string;
  unit: string;
  quantity: number;
  wastePercent: number;
};
export type ImportResult = { lines: ImportLine[]; skipped: string[]; truncated: boolean };

export const importLineSchema = z.object({
  section: z.string().trim().min(1).max(60),
  description: z.string().trim().min(2).max(200),
  unit: z.string().trim().min(1).max(16),
  quantity: z.coerce.number().finite().gt(0).max(1e9),
  wastePercent: z.coerce.number().finite().min(0).max(100).default(0),
});
export const importLinesSchema = z
  .array(importLineSchema)
  .min(1, "Select at least one line")
  .max(IMPORT_MAX_LINES);

const clean = (s: string) =>
  s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Minimal CSV/TSV row splitter with double-quote support. */
export function splitRow(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function detectDelimiter(lines: string[]): string | null {
  const sample = lines.slice(0, 10);
  for (const d of ["\t", ";", ","]) {
    const counts = sample.map((l) => splitRow(l, d).length);
    if (counts.filter((c) => c >= 3).length >= Math.max(1, Math.ceil(sample.length / 2))) return d;
  }
  return null;
}

/** "1,200" / "1.200,5" / "12.5" -> number; NaN when it is not a plain number. */
export function parseNumber(raw: string): number {
  let t = raw.trim().replace(/\s/g, "");
  if (!/^[\d.,]+$/.test(t)) return NaN;
  if (t.includes(",") && t.includes(".")) {
    t =
      t.lastIndexOf(",") > t.lastIndexOf(".")
        ? t.replace(/\./g, "").replace(",", ".")
        : t.replace(/,/g, "");
  } else if (t.includes(",")) {
    t = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  }
  return Number(t);
}

const HEAD = {
  description: /^(description|item|material|product|name|particulars)/i,
  quantity: /^(qty|quantity|qnty|amount)/i,
  unit: /^(unit|uom)/i,
  section: /^(section|category|group|trade|bill)/i,
  waste: /^(waste|wastage)/i,
};

function mapHeader(cells: string[]) {
  const idx = { description: -1, quantity: -1, unit: -1, section: -1, waste: -1 };
  cells.forEach((c, i) => {
    for (const k of Object.keys(idx) as (keyof typeof idx)[])
      if (idx[k] === -1 && HEAD[k].test(c.trim())) idx[k] = i;
  });
  return idx.description >= 0 && idx.quantity >= 0 ? idx : null;
}

const HEURISTICS = [
  // "Cement 42.5N, 200 bags" / "Rebar 12mm - 5 tons"
  /^(?<desc>.+?)[\s:,\-–—]+(?<qty>\d[\d.,]*)\s*(?<unit>[A-Za-z²³.\/]{1,12})$/,
  // "200 bags cement"
  /^(?<qty>\d[\d.,]*)\s*(?<unit>[A-Za-z²³.\/]{1,12})\s+(?<desc>.+)$/,
];

function fromFreeText(line: string, section: string): ImportLine | null {
  for (const re of HEURISTICS) {
    const m = re.exec(line);
    if (!m?.groups) continue;
    const unit = m.groups.unit!.replace(/\.$/, "");
    if (!matchUnitCode(unit)) continue; // only trust units we recognise
    const quantity = parseNumber(m.groups.qty!);
    const description = clean(m.groups.desc!.replace(/^[\-–—•*\d.)\s]+(?=[A-Za-z])/, ""));
    if (!Number.isFinite(quantity) || quantity <= 0 || description.length < 2) continue;
    return { section, description, unit, quantity, wastePercent: 0 };
  }
  return null;
}

export function parseBoqList(text: string): ImportResult {
  const rows = text
    .slice(0, IMPORT_MAX_CHARS)
    .split(/\r?\n/)
    .map((l) => l.replace(/^﻿/, ""))
    .filter((l) => l.trim());
  const lines: ImportLine[] = [];
  const skipped: string[] = [];
  let truncated = false;
  const seen = new Set<string>();
  const push = (l: ImportLine) => {
    const v = importLineSchema.safeParse({
      ...l,
      description: clean(l.description),
      section: clean(l.section) || "Imported",
      unit: clean(l.unit),
    });
    if (!v.success) return false;
    const key = `${v.data.section}|${v.data.description}|${v.data.unit}`.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
    if (lines.length >= IMPORT_MAX_LINES) {
      truncated = true;
      return true;
    }
    lines.push({
      ...v.data,
      quantity: Math.round(v.data.quantity * 1000) / 1000,
      wastePercent: Math.round(v.data.wastePercent * 100) / 100,
    });
    return true;
  };

  const delim = detectDelimiter(rows);
  if (delim) {
    let head = mapHeader(splitRow(rows[0]!, delim));
    const body = head ? rows.slice(1) : rows;
    // No header: assume Description, Quantity, Unit[, Section] when the second column is numeric.
    if (!head) head = { description: 0, quantity: 1, unit: 2, section: 3, waste: -1 };
    let section = "Imported";
    for (const r of body) {
      const c = splitRow(r, delim);
      const qty = parseNumber(c[head.quantity] ?? "");
      const desc = c[head.description] ?? "";
      if (!Number.isFinite(qty) && desc && c.slice(1).every((x) => !x)) {
        section = clean(desc).slice(0, 60) || section; // a lone cell is a section heading
        continue;
      }
      const unit = head.unit >= 0 ? (c[head.unit] ?? "") : "";
      const ok =
        Number.isFinite(qty) &&
        push({
          section: (head.section >= 0 ? c[head.section] : "") || section,
          description: desc,
          unit,
          quantity: qty,
          wastePercent: head.waste >= 0 ? parseNumber(c[head.waste] ?? "0") || 0 : 0,
        });
      if (!ok) skipped.push(clean(r).slice(0, 80));
    }
  } else {
    let section = "Imported";
    for (const r of rows) {
      const t = clean(r);
      const l = fromFreeText(t, section);
      if (l) {
        push(l);
      } else if (/^[A-Z][^\d]{1,58}:?$/.test(t)) {
        section = t.replace(/:$/, "").slice(0, 60); // heading line, no numbers
      } else skipped.push(t.slice(0, 80));
    }
  }
  return { lines, skipped: skipped.slice(0, 20), truncated };
}
