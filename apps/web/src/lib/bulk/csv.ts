/** RFC 4180 CSV/TSV reading: quoted cells, embedded delimiters and newlines, BOM, delimiter sniffing. */

export type Grid = string[][];

/** Decodes bytes as UTF-8, falling back to Windows-1252 for files saved by older Excel versions. */
export function decodeText(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(u8).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(u8);
  }
}

export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 20_000).split(/\r?\n/).filter(Boolean).slice(0, 8);
  let best = ",";
  let bestScore = -1;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = sample.map((l) => parseCsv(l, d)[0]?.length ?? 0);
    if (!counts.length || counts[0]! < 2) continue;
    const consistent = counts.filter((c) => c === counts[0]).length;
    const score = consistent * 10 + counts[0]!;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** Parses the whole text into rows of cells. Blank lines are skipped; short rows are kept as they are. */
export function parseCsv(text: string, delimiter?: string): Grid {
  const d = delimiter ?? detectDelimiter(text);
  const rows: Grid = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let started = false; // any character seen on the current line
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (started || row.some((c) => c !== "")) rows.push(row);
    row = [];
    started = false;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") {
      quoted = true;
      started = true;
    } else if (ch === d) {
      endCell();
      started = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (started || cell !== "" || row.length) endRow();
    } else {
      cell += ch;
      started = true;
    }
  }
  if (started || cell !== "" || row.length) endRow();
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Writes rows as CSV. Cells that a spreadsheet could run as a formula are neutralised with a leading apostrophe. */
export function toCsv(
  rows: (string | number | null | undefined)[][],
  opts: { bom?: boolean } = {},
): string {
  const esc = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d[\d.,]*$/.test(s)) s = `'${s}`;
    return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (opts.bom ? "﻿" : "") + rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
