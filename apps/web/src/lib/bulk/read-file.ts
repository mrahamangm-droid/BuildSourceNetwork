import { decodeText, parseCsv, type Grid } from "./csv";
import { readXlsx, type SheetData } from "./xlsx-read";

export const MAX_FILE_BYTES = 80 * 1024 * 1024;

export type ParsedFile = { filename: string; sheets: SheetData[] };

/** Reads an uploaded .xlsx, .csv, .tsv or .txt file into one or more sheets of plain text cells. */
export async function readSpreadsheetFile(file: File): Promise<ParsedFile> {
  if (file.size > MAX_FILE_BYTES)
    throw new Error("This file is larger than 80 MB. Split it into several files.");
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (name.endsWith(".xls"))
    throw new Error(
      "Old .xls files are not supported. In Excel choose File > Save As > Excel Workbook (.xlsx) or CSV.",
    );
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    const sheets = (await readXlsx(bytes)).filter((s) => s.rows.length > 0);
    if (!sheets.length) throw new Error("The workbook has no data.");
    return { filename: file.name, sheets };
  }
  if (/\.(csv|tsv|txt)$/.test(name)) {
    const rows: Grid = parseCsv(decodeText(bytes));
    if (!rows.length) throw new Error("The file is empty.");
    return { filename: file.name, sheets: [{ name: "File", rows }] };
  }
  throw new Error("Choose an .xlsx or .csv file.");
}

/** The sheet most likely to hold products: named Products, else the one with the most rows. */
export function pickSheet(sheets: SheetData[]): number {
  const named = sheets.findIndex((s) => s.name.toLowerCase() === "products");
  if (named >= 0) return named;
  let best = 0;
  sheets.forEach((s, i) => {
    if (s.rows.length > sheets[best]!.rows.length) best = i;
  });
  return best;
}
