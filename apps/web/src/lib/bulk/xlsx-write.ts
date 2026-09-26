import { writeZip } from "./zip";

export type Cell = string | number | null;
export type Validation = {
  /** Cell range like "C2:C5000". */
  sqref: string;
  /** Excel formula that yields the allowed list, e.g. `Lists!$A$2:$A$50` or `INDIRECT(...)`. */
  formula: string;
  title?: string;
  error?: string;
  /** false = show a warning but allow other values (used where suppliers may add new values). */
  strict?: boolean;
};
export type SheetSpec = {
  name: string;
  rows: Cell[][];
  hidden?: boolean;
  widths?: number[];
  /** Style row 1 as a header and freeze it. */
  header?: boolean;
  /** Column indexes (0-based) whose cells are stored as text (SKUs with leading zeros). */
  textColumns?: number[];
  validations?: Validation[];
  /** Header cells (by column index) marked as required get a highlighted fill. */
  requiredColumns?: number[];
};
export type DefinedName = { name: string; ref: string };

const esc = (s: string) =>
  s
    .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

export function colLetter(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function sheetXml(s: SheetSpec): string {
  const textCols = new Set(s.textColumns ?? []);
  const req = new Set(s.requiredColumns ?? []);
  const cols = s.widths?.length
    ? `<cols>${s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const rows = s.rows
    .map((r, ri) => {
      const cells = r
        .map((v, ci) => {
          if (v == null || v === "") return "";
          const ref = `${colLetter(ci)}${ri + 1}`;
          const style =
            s.header && ri === 0
              ? req.has(ci)
                ? ' s="2"'
                : ' s="1"'
              : textCols.has(ci)
                ? ' s="3"'
                : "";
          if (typeof v === "number" && Number.isFinite(v))
            return `<c r="${ref}"${style}><v>${v}</v></c>`;
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  const pane = s.header
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const dv = s.validations?.length
    ? `<dataValidations count="${s.validations.length}">${s.validations
        .map(
          (v) =>
            `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="${v.strict === false ? "warning" : "stop"}" ${v.title ? `errorTitle="${esc(v.title)}" ` : ""}${v.error ? `error="${esc(v.error)}" ` : ""}sqref="${v.sqref}"><formula1>${esc(v.formula)}</formula1></dataValidation>`,
        )
        .join("")}</dataValidations>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData>${dv}</worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function buildXlsx(sheets: SheetSpec[], names: DefinedName[] = []): Uint8Array {
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
    .map(
      (s, i) =>
        `<sheet name="${esc(s.name)}"${s.hidden ? ' state="hidden"' : ""} sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join("")}</sheets>${
    names.length
      ? `<definedNames>${names.map((n) => `<definedName name="${n.name}">${esc(n.ref)}</definedName>`).join("")}</definedNames>`
      : ""
  }</workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join(
      "",
    )}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("")}</Types>`;
  const root = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  return writeZip([
    { name: "[Content_Types].xml", data: types },
    { name: "_rels/.rels", data: root },
    { name: "xl/workbook.xml", data: wb },
    { name: "xl/_rels/workbook.xml.rels", data: rels },
    { name: "xl/styles.xml", data: STYLES },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ]);
}
