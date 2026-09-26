import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildXlsx } from "../src/lib/bulk/xlsx-write";
import { readXlsx } from "../src/lib/bulk/xlsx-read";

describe("xlsx round trip", () => {
  it("writes and reads text, numbers, unicode, escapes and hidden sheets", async () => {
    const bytes = buildXlsx(
      [
        {
          name: "Products",
          header: true,
          rows: [
            ["SKU", "Name", "Price"],
            ["00123", 'Cement <OPC> & "co"', 12.5],
            ["A2", "عربي ☃", 1250000],
            [null, null, null],
            ["Z9", "last", 0.1],
          ],
          textColumns: [0],
          validations: [{ sqref: "B2:B10", formula: "Lists!$A$1:$A$3" }],
        },
        { name: "Lists", hidden: true, rows: [["x"], ["y"]] },
      ],
      [{ name: "cat_a", ref: "Lists!$A$1:$A$2" }],
    );
    const sheets = await readXlsx(bytes);
    expect(sheets.map((s) => s.name)).toEqual(["Products"]);
    expect(sheets[0]!.rows[1]).toEqual(["00123", 'Cement <OPC> & "co"', "12.5"]);
    expect(sheets[0]!.rows[2]).toEqual(["A2", "عربي ☃", "1250000"]);
    expect(sheets[0]!.rows[4]).toEqual(["Z9", "last", "0.1"]);
  });

  const hasPy = (() => {
    try {
      execFileSync("python3", ["-c", "import openpyxl"]);
      return true;
    } catch {
      return false;
    }
  })();
  it.runIf(hasPy)(
    "reads a workbook produced by openpyxl (shared strings, compressed, dates)",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "xl-"));
      const f = join(dir, "t.xlsx");
      execFileSync("python3", [
        "-c",
        `import openpyxl,sys
wb=openpyxl.Workbook();ws=wb.active;ws.title="Data"
ws.append(["SKU","Qty","Note"]);ws.append(["a1",1500000,"héllo & <b>"]);ws.append(["b2",0.30000000000000004,None]);ws["D4"]="far";ws["A5"]="=1+2"
wb.create_sheet("Second").append(["q"])
wb.save(sys.argv[1])`,
        f,
      ]);
      const sheets = await readXlsx(new Uint8Array(readFileSync(f)));
      expect(sheets.map((s) => s.name)).toEqual(["Data", "Second"]);
      const r = sheets[0]!.rows;
      expect(r[0]).toEqual(["SKU", "Qty", "Note"]);
      expect(r[1]).toEqual(["a1", "1500000", "héllo & <b>"]);
      expect(r[2]![1]).toBe("0.3");
      expect(r[3]![3]).toBe("far");
    },
  );

  it.runIf(existsSync("/usr/bin/soffice") || existsSync("/usr/bin/libreoffice"))(
    "our generated workbook opens in LibreOffice",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "xl-"));
      const f = join(dir, "g.xlsx");
      writeFileSync(f, buildXlsx([{ name: "A", rows: [["h"], ["v"]], header: true }]));
      execFileSync("soffice", ["--headless", "--convert-to", "csv", "--outdir", dir, f], {
        timeout: 90000,
      });
      expect(readFileSync(join(dir, "g.csv"), "utf8")).toContain("v");
    },
    100000,
  );
});
