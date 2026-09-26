import { FIELDS } from "./fields";
import {
  buildXlsx,
  colLetter,
  type Cell,
  type DefinedName,
  type SheetSpec,
  type Validation,
} from "./xlsx-write";
import type { Refs } from "./validate";

export const TEMPLATE_DATA_ROWS = 5000;

const STOCK_LABELS = ["In stock", "Low stock", "Out of stock", "On request"];

/**
 * Builds the downloadable product workbook: a Products sheet with drop-downs (Category,
 * Subcategory that depends on it, Product Type that depends on both, Unit, Availability, Yes/No),
 * an Instructions sheet, and a hidden Lists sheet that feeds the drop-downs.
 */
export function buildProductTemplate(refs: Refs): Uint8Array {
  const cats = [...refs.categories].sort((a, b) => a.name.localeCompare(b.name));
  const units = [...refs.unitCodes].sort();

  // Hidden lists. Sub-categories and types live in one long column each, ordered by parent, so a
  // defined name can point at each parent's slice (dependent drop-downs via INDIRECT).
  const subCol: string[] = [];
  const typeCol: string[] = [];
  const names: DefinedName[] = [];
  const catKeys: [string, string][] = [];
  const subKeys: [string, string][] = [];
  let subN = 0;
  cats.forEach((c, ci) => {
    const subs = refs.subcategories
      .filter((s) => s.categoryId === c.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!subs.length) return;
    const start = subCol.length + 2;
    for (const s of subs) subCol.push(s.name);
    const nm = `cat_${ci + 1}`;
    names.push({ name: nm, ref: `Lists!$I$${start}:$I$${subCol.length + 1}` });
    catKeys.push([c.name, nm]);
    for (const s of subs) {
      const types = refs.types
        .filter((t) => t.subcategoryId === s.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!types.length) continue;
      subN += 1;
      const ts = typeCol.length + 2;
      for (const t of types) typeCol.push(t.name);
      const sn = `sub_${subN}`;
      names.push({ name: sn, ref: `Lists!$J$${ts}:$J$${typeCol.length + 1}` });
      subKeys.push([`${c.name}|${s.name}`, sn]);
    }
  });

  const listRows =
    Math.max(
      units.length,
      cats.length,
      STOCK_LABELS.length,
      catKeys.length,
      subKeys.length,
      subCol.length,
      typeCol.length,
    ) + 1;
  const lists: Cell[][] = [
    [
      "Units",
      "Categories",
      "Availability",
      "YesNo",
      "CategoryKey",
      "CategoryName",
      "SubKey",
      "SubName",
      "Subcategories",
      "Types",
    ],
  ];
  for (let i = 0; i < listRows - 1; i++)
    lists.push([
      units[i] ?? null,
      cats[i]?.name ?? null,
      STOCK_LABELS[i] ?? null,
      i === 0 ? "Yes" : i === 1 ? "No" : null,
      catKeys[i]?.[0] ?? null,
      catKeys[i]?.[1] ?? null,
      subKeys[i]?.[0] ?? null,
      subKeys[i]?.[1] ?? null,
      subCol[i] ?? null,
      typeCol[i] ?? null,
    ]);

  const colOf = (key: string) => FIELDS.findIndex((f) => f.key === key);
  const last = TEMPLATE_DATA_ROWS + 1;
  const range = (key: string) => `${colLetter(colOf(key))}2:${colLetter(colOf(key))}${last}`;
  const cat = colLetter(colOf("category"));
  const sub = colLetter(colOf("subcategory"));
  const validations: Validation[] = [
    {
      sqref: range("category"),
      formula: `Lists!$B$2:$B$${cats.length + 1}`,
      title: "Category",
      error: "Pick a category from the list.",
    },
    {
      sqref: range("subcategory"),
      formula: `INDIRECT(VLOOKUP($${cat}2,Lists!$E$2:$F$${Math.max(2, catKeys.length + 1)},2,FALSE))`,
      title: "Subcategory",
      error: "Pick a subcategory of the chosen category.",
    },
    {
      sqref: range("productType"),
      formula: `INDIRECT(VLOOKUP($${cat}2&"|"&$${sub}2,Lists!$G$2:$H$${Math.max(2, subKeys.length + 1)},2,FALSE))`,
      title: "Product type",
      error: "Pick a product type of the chosen subcategory.",
    },
    {
      sqref: range("unit"),
      formula: `Lists!$A$2:$A$${units.length + 1}`,
      title: "Unit",
      error: "Pick a unit from the list.",
    },
    {
      sqref: range("stockStatus"),
      formula: `Lists!$C$2:$C$${STOCK_LABELS.length + 1}`,
      title: "Availability",
      error: "Pick an availability.",
    },
    {
      sqref: range("delivery"),
      formula: "Lists!$D$2:$D$3",
      title: "Delivery",
      error: "Yes or No.",
    },
    { sqref: range("active"), formula: "Lists!$D$2:$D$3", title: "Active", error: "Yes or No." },
  ];

  const products: SheetSpec = {
    name: "Products",
    header: true,
    rows: [FIELDS.map((f) => (f.required ? `${f.label} *` : f.label))],
    widths: FIELDS.map((f) => f.width),
    textColumns: FIELDS.map((f, i) => (f.text ? i : -1)).filter((i) => i >= 0),
    requiredColumns: FIELDS.map((f, i) => (f.required ? i : -1)).filter((i) => i >= 0),
    validations,
  };

  const instr: Cell[][] = [
    ["BuildSourceNetwork product import template"],
    [],
    ["How to use"],
    [
      "1. Fill the Products sheet, one product per row. Columns marked * are required for new products.",
    ],
    [
      "2. Use the drop-downs for Category, Subcategory, Product Type, Unit and Availability. Subcategory depends on Category; Product Type depends on Subcategory.",
    ],
    [
      "3. Leave a cell empty if you do not have the value. Do not delete or rename the header row (you can reorder columns; we map them by name).",
    ],
    [
      "4. To update existing products (price, stock, MOQ), fill SKU plus only the columns you want to change, then choose “Update existing” when you upload.",
    ],
    [
      "5. Numbers may use thousands separators (1,250.50 or 1.250,50) and currency symbols. We never guess: anything unclear is listed in an error report with the row and how to fix it.",
    ],
    [
      "6. Upload .xlsx or .csv files of any size up to 100,000 rows. Larger catalogues: split into several files.",
    ],
    [],
    ["Column", "Required for new products", "Example", "Notes"],
    ...FIELDS.map((f): Cell[] => [f.label, f.required ? "Yes" : "No", f.example || null, f.help]),
  ];
  const instructions: SheetSpec = { name: "Instructions", rows: instr, widths: [24, 24, 30, 90] };
  const listsSheet: SheetSpec = { name: "Lists", rows: lists, hidden: true };
  return buildXlsx([products, instructions, listsSheet], names);
}

/** A small CSV variant for people who work outside Excel. */
export function productTemplateCsvHeader(): string {
  return FIELDS.map((f) => f.label).join(",") + "\n";
}
