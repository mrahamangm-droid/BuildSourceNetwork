import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProductTemplate } from "../src/lib/bulk/template";
import { readXlsx } from "../src/lib/bulk/xlsx-read";
import { autoMapColumns } from "../src/lib/bulk/mapping";
import { FIELDS } from "../src/lib/bulk/fields";
import type { Refs } from "../src/lib/bulk/validate";

const refs: Refs = {
  categories: [
    { id: "c1", name: "Cement", slug: "cement" },
    { id: "c2", name: "Steel & Rebar", slug: "steel" },
  ],
  subcategories: [
    { id: "s1", categoryId: "c1", name: "Portland cement", slug: "p" },
    { id: "s2", categoryId: "c1", name: "Masonry cement", slug: "m" },
    { id: "s3", categoryId: "c2", name: "Rebar", slug: "r" },
  ],
  types: [
    { id: "t1", subcategoryId: "s1", name: "OPC", slug: "opc" },
    { id: "t2", subcategoryId: "s1", name: "White cement", slug: "w" },
  ],
  unitCodes: ["BAG", "TON"],
};

describe("product template", () => {
  it("has a header row that maps back to every field", async () => {
    const sheets = await readXlsx(buildProductTemplate(refs));
    expect(sheets.map((s) => s.name)).toEqual(["Products", "Instructions"]);
    const map = autoMapColumns(sheets[0]!.rows[0]!);
    expect(Object.keys(map).length).toBe(FIELDS.length);
  });
  const hasPy = (() => {
    try {
      execFileSync("python3", ["-c", "import openpyxl"]);
      return true;
    } catch {
      return false;
    }
  })();
  it.runIf(hasPy)("carries dependent drop-downs and named ranges (checked with openpyxl)", () => {
    const f = join(mkdtempSync(join(tmpdir(), "tpl-")), "t.xlsx");
    writeFileSync(f, buildProductTemplate(refs));
    const out = execFileSync(
      "python3",
      [
        "-c",
        `import openpyxl,sys,json
wb=openpyxl.load_workbook(sys.argv[1])
ws=wb["Products"]
dv=[(str(d.sqref), d.formula1) for d in ws.data_validations.dataValidation]
print(json.dumps({"dv":dv,"names":list(wb.defined_names.keys()),"hidden":wb["Lists"].sheet_state,"h":ws["B1"].value}))`,
        f,
      ],
      { encoding: "utf8" },
    );
    const j = JSON.parse(out);
    expect(j.hidden).toBe("hidden");
    expect(j.h).toBe("Product Name *");
    expect(j.names).toEqual(expect.arrayContaining(["cat_1", "cat_2", "sub_1"]));
    expect(j.dv.length).toBe(7);
    expect(j.dv.some(([, fm]: [string, string]) => fm.startsWith("INDIRECT(VLOOKUP($C2,"))).toBe(
      true,
    );
    expect(readFileSync(f).length).toBeGreaterThan(1000);
  });
});
