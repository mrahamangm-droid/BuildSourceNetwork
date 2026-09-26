/**
 * Turns BOQ lines into RFQ line items. Pure, so the mapping is testable.
 * The result only pre-fills the RFQ form: the buyer reviews and edits every field,
 * because a bill of quantities describes works (excavation, formwork) as well as
 * materials, and units are free text there.
 */
import { orderQty } from "./boq";

const UNIT_ALIASES: Record<string, string> = {
  m2: "SQM",
  sqm: "SQM",
  "sq.m": "SQM",
  "m²": "SQM",
  m3: "CBM",
  cbm: "CBM",
  "m³": "CBM",
  m: "METER",
  meter: "METER",
  metre: "METER",
  lm: "METER",
  rm: "METER",
  kg: "KG",
  kgs: "KG",
  kilogram: "KG",
  t: "TON",
  ton: "TON",
  tons: "TON",
  tonne: "TON",
  tonnes: "TON",
  pc: "PIECE",
  pcs: "PIECE",
  piece: "PIECE",
  pieces: "PIECE",
  nos: "PIECE",
  no: "PIECE",
  each: "PIECE",
  bag: "BAG",
  bags: "BAG",
  box: "BOX",
  boxes: "BOX",
  l: "LITER",
  ltr: "LITER",
  liter: "LITER",
  litre: "LITER",
  liters: "LITER",
  litres: "LITER",
  roll: "ROLL",
  rolls: "ROLL",
  set: "SET",
  sets: "SET",
  pallet: "PALLET",
  pallets: "PALLET",
  truck: "TRUCK",
  trucks: "TRUCK",
  load: "TRUCK",
};

/** Unit code for a free-text unit, or "" when unknown (the form then forces a choice). */
export function matchUnitCode(text: string, knownCodes?: string[]): string {
  const code = UNIT_ALIASES[text.trim().toLowerCase()] ?? "";
  if (!code) return "";
  return knownCodes && !knownCodes.includes(code) ? "" : code;
}

const CATEGORY_RULES: [RegExp, string][] = [
  [/\b(reinforcement|rebar|steel|mesh)\b/i, "Steel"],
  [/\b(blocks?|blockwork)\b/i, "Blocks"],
  [/\b(tiles?|tiling)\b/i, "Tiles"],
  [/\bpaint(ing)?\b/i, "Paint"],
  [/\bwaterproof(ing)?\b/i, "Waterproofing"],
  [/\bcement\b/i, "Cement"],
  [/\bsand\b/i, "Sand"],
  [/\b(gravel|aggregates?)\b/i, "Gravel"],
  [/\b(gypsum|plasterboard)\b/i, "Gypsum"],
  [/\b(pipes?|plumbing)\b/i, "Plumbing"],
  [/\b(cables?|wiring|electrical)\b/i, "Electrical"],
  [/\binsulation\b/i, "Insulation"],
  [/\bdoors?\b/i, "Doors"],
  [/\bwindows?\b/i, "Windows"],
  [/\broof(ing)?\b/i, "Roofing"],
];

/** Category name for a description, or "" when nothing matches confidently. */
export function guessCategoryName(description: string): string {
  for (const [re, name] of CATEGORY_RULES) if (re.test(description)) return name;
  return "";
}

export type RfqPrefillItem = {
  name: string;
  categoryId: string;
  productId: string;
  quantity: string;
  unitCode: string;
  specification: string;
};

export const MAX_RFQ_LINES = 30;

export function boqLineToRfqItem(
  line: {
    section: string;
    description: string;
    unit: string;
    quantity: number;
    wastePercent: number;
  },
  ctx: { projectName: string; categories: { id: string; name: string }[]; unitCodes: string[] },
): RfqPrefillItem {
  const catName = guessCategoryName(line.description);
  const cat = ctx.categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
  const waste = line.wastePercent > 0 ? `, includes ${line.wastePercent}% waste` : "";
  return {
    name: line.description,
    categoryId: cat?.id ?? "",
    productId: "",
    quantity: String(orderQty(line)),
    unitCode: matchUnitCode(line.unit, ctx.unitCodes),
    specification: `From project "${ctx.projectName}", ${line.section}${waste}`.slice(0, 500),
  };
}
