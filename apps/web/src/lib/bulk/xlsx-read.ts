import { readZip, textOf } from "./zip";
import type { Grid } from "./csv";

export type SheetData = { name: string; rows: Grid };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function unxml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

function textNodes(xml: string): string {
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) out += unxml(m[1] ?? "");
  return out;
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** Numbers come back as their shortest exact text, avoiding 0.30000000000000004 style noise. */
function numText(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return String(Number(n.toPrecision(15)));
}

export const XLSX_LIMITS = { maxRows: 200_000, maxCols: 200 };

/**
 * Reads worksheets of an .xlsx workbook into plain string grids. Formulas contribute their cached
 * value, shared and inline strings are resolved, and empty trailing rows are dropped.
 */
export async function readXlsx(bytes: Uint8Array): Promise<SheetData[]> {
  const z = await readZip(bytes);
  const wb = textOf(z, "xl/workbook.xml");
  if (!wb) throw new Error("This is not a valid .xlsx file.");
  const rels = textOf(z, "xl/_rels/workbook.xml.rels") ?? "";
  const relTarget = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]*)"/.exec(m[0])?.[1];
    const target = /\bTarget="([^"]*)"/.exec(m[0])?.[1];
    if (id && target) relTarget.set(id, target);
  }
  const shared: string[] = [];
  const sst = textOf(z, "xl/sharedStrings.xml");
  if (sst)
    for (const m of sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\s*\/>/g))
      shared.push(textNodes(m[1] ?? ""));

  const sheets: SheetData[] = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = unxml(/\bname="([^"]*)"/.exec(m[0])?.[1] ?? "Sheet");
    const state = /\bstate="([^"]*)"/.exec(m[0])?.[1];
    if (state === "hidden" || state === "veryHidden") continue;
    const rid = /\br:id="([^"]*)"/.exec(m[0])?.[1];
    let target = rid ? relTarget.get(rid) : undefined;
    if (!target) continue;
    target = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    const xml = textOf(z, target);
    if (!xml) continue;
    const rows: Grid = [];
    let rowNo = 0;
    for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rAttr = /\br="(\d+)"/.exec(rm[1] ?? "")?.[1];
      rowNo = rAttr ? Number(rAttr) - 1 : rowNo;
      if (rowNo >= XLSX_LIMITS.maxRows)
        throw new Error(
          `Too many rows (limit ${XLSX_LIMITS.maxRows.toLocaleString("en")}). Split the file.`,
        );
      const body = rm[2];
      if (body) {
        const row: string[] = [];
        let col = 0;
        for (const cm of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const attrs = cm[1] ?? "";
          const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
          col = ref ? colIndex(ref) : col;
          const type = /\bt="([^"]*)"/.exec(attrs)?.[1] ?? "n";
          const inner = cm[2] ?? "";
          let val = "";
          if (type === "inlineStr") val = textNodes(inner);
          else {
            const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
            if (v != null) {
              if (type === "s") val = shared[Number(v)] ?? "";
              else if (type === "b") val = v === "1" ? "TRUE" : "FALSE";
              else if (type === "str" || type === "e") val = unxml(v);
              else val = numText(v);
            }
          }
          if (col < XLSX_LIMITS.maxCols) {
            while (row.length < col) row.push("");
            row[col] = val;
          }
          col++;
        }
        while (rows.length < rowNo) rows.push([]);
        rows[rowNo] = row;
      }
      rowNo++;
    }
    while (rows.length && rows[rows.length - 1]!.every((c) => !c || !c.trim())) rows.pop();
    sheets.push({ name, rows });
  }
  return sheets;
}
