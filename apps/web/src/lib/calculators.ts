/**
 * Free construction calculators. Pure functions, metric units, no I/O, so they
 * are unit-tested and safe to ship to the client bundle.
 *
 * Every result is an estimate for planning and RFQ preparation. Site
 * conditions, workmanship and local standards change real consumption.
 */

export type InputDef =
  | { key: string; label: string; unit?: string; type: "number"; default: number; min?: number; step?: number }
  | { key: string; label: string; type: "select"; default: string; options: { value: string; label: string }[] };

export type ResultRow = { label: string; value: number; unit: string; primary?: boolean; decimals?: number };
export type CalcOutput = { rows: ResultRow[]; notes?: string[] };
export type Values = Record<string, number | string>;

export type Calculator = {
  slug: string;
  name: string;
  short: string;
  description: string;
  /** Category slug on the marketplace used for the "get quotes" link. */
  categoryHint?: string;
  inputs: InputDef[];
  compute: (v: Values) => CalcOutput;
  faqs: { q: string; a: string }[];
};

const num = (v: Values, k: string) => {
  const n = Number(v[k]);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const str = (v: Values, k: string) => String(v[k] ?? "");
const pct = (v: Values, k: string) => Math.min(Math.max(Number(v[k]) || 0, 0), 100) / 100;
const round = (n: number, d = 2) => {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/* ---------- constants (documented so they can be challenged) ---------- */
/** Dry-volume factor: wet concrete needs ~1.54x dry material after voids fill. */
export const DRY_CONCRETE_FACTOR = 1.54;
/** Dry-volume factor for mortar and plaster. */
export const DRY_MORTAR_FACTOR = 1.33;
/** Loose cement density, kg/m3. */
export const CEMENT_DENSITY = 1440;
/** Standard bag, kg. */
export const BAG_KG = 50;
export const BAG_M3 = BAG_KG / CEMENT_DENSITY;
/** Steel density, kg/m3; d^2/162.2 is the metric rule for kg per metre with d in mm. */
export const steelKgPerM = (dMm: number) => (dMm * dMm) / 162.2;

const MIXES: Record<string, { label: string; c: number; s: number; a: number }> = {
  M10: { label: "M10 (1 : 3 : 6)", c: 1, s: 3, a: 6 },
  M15: { label: "M15 (1 : 2 : 4)", c: 1, s: 2, a: 4 },
  M20: { label: "M20 (1 : 1.5 : 3)", c: 1, s: 1.5, a: 3 },
  M25: { label: "M25 (1 : 1 : 2)", c: 1, s: 1, a: 2 },
};
const mixOptions = Object.entries(MIXES).map(([value, m]) => ({ value, label: m.label }));

/** Materials for a wet volume (m3) of concrete at a given nominal mix. */
export function concreteMaterials(wetM3: number, mix: string) {
  const m = MIXES[mix] ?? MIXES.M20;
  const dry = wetM3 * DRY_CONCRETE_FACTOR;
  const parts = m.c + m.s + m.a;
  const cementM3 = (dry * m.c) / parts;
  return {
    cementM3,
    bags: cementM3 / BAG_M3,
    cementKg: cementM3 * CEMENT_DENSITY,
    sandM3: (dry * m.s) / parts,
    aggregateM3: (dry * m.a) / parts,
  };
}

const wasteInput: InputDef = {
  key: "waste",
  label: "Wastage allowance",
  unit: "%",
  type: "number",
  default: 5,
  min: 0,
  step: 1,
};

/* ------------------------------ calculators ----------------------------- */

const concrete: Calculator = {
  slug: "concrete-calculator",
  name: "Concrete Calculator",
  short: "Volume of concrete plus cement, sand and aggregate for slabs, footings and columns.",
  description:
    "Work out how much concrete you need for a slab, footing or column, and how many bags of cement, cubic metres of sand and aggregate that means for your chosen mix.",
  categoryHint: "cement",
  inputs: [
    { key: "length", label: "Length", unit: "m", type: "number", default: 5, min: 0, step: 0.1 },
    { key: "width", label: "Width", unit: "m", type: "number", default: 4, min: 0, step: 0.1 },
    { key: "depth", label: "Thickness / depth", unit: "m", type: "number", default: 0.15, min: 0, step: 0.01 },
    { key: "mix", label: "Concrete mix", type: "select", default: "M20", options: mixOptions },
    { ...wasteInput, default: 5 },
  ],
  compute: (v) => {
    const wet = num(v, "length") * num(v, "width") * num(v, "depth") * (1 + pct(v, "waste"));
    const m = concreteMaterials(wet, str(v, "mix"));
    return {
      rows: [
        { label: "Concrete volume", value: wet, unit: "m³", primary: true },
        { label: "Cement", value: Math.ceil(m.bags), unit: "bags (50 kg)", decimals: 0 },
        { label: "Sand", value: m.sandM3, unit: "m³" },
        { label: "Coarse aggregate", value: m.aggregateM3, unit: "m³" },
      ],
      notes: [
        "Nominal mixes by volume. Structural work should follow the engineer's design mix.",
        `Uses a dry-volume factor of ${DRY_CONCRETE_FACTOR} and ${BAG_KG} kg bags at ${CEMENT_DENSITY} kg/m³.`,
      ],
    };
  },
  faqs: [
    {
      q: "How is concrete volume calculated?",
      a: "Multiply length by width by thickness, all in metres, to get cubic metres. Add a wastage allowance for spillage and uneven sub-base, usually 3 to 10 percent.",
    },
    {
      q: "Why is dry volume larger than wet volume?",
      a: "Loose cement, sand and aggregate contain voids that fill when water is added and the mix is compacted, so roughly 54 percent more dry material is needed than the finished volume.",
    },
  ],
};

const cement: Calculator = {
  slug: "cement-calculator",
  name: "Cement Calculator",
  short: "Cement bags and sand for plaster, screed and block-work mortar.",
  description:
    "Estimate cement bags and sand for plastering, screeding or mortar by area, thickness and mortar ratio.",
  categoryHint: "cement",
  inputs: [
    { key: "area", label: "Area to cover", unit: "m²", type: "number", default: 50, min: 0, step: 1 },
    { key: "thickness", label: "Thickness", unit: "mm", type: "number", default: 12, min: 0, step: 1 },
    {
      key: "ratio",
      label: "Mortar ratio (cement : sand)",
      type: "select",
      default: "4",
      options: [
        { value: "3", label: "1 : 3 (rich, waterproof / screed)" },
        { value: "4", label: "1 : 4 (plaster, general)" },
        { value: "5", label: "1 : 5 (internal plaster)" },
        { value: "6", label: "1 : 6 (block-work mortar)" },
      ],
    },
    { ...wasteInput, default: 10 },
  ],
  compute: (v) => {
    const wet = num(v, "area") * (num(v, "thickness") / 1000) * (1 + pct(v, "waste"));
    const dry = wet * DRY_MORTAR_FACTOR;
    const s = Number(str(v, "ratio")) || 4;
    const cementM3 = dry / (1 + s);
    return {
      rows: [
        { label: "Cement", value: Math.ceil(cementM3 / BAG_M3), unit: "bags (50 kg)", primary: true, decimals: 0 },
        { label: "Cement weight", value: cementM3 * CEMENT_DENSITY, unit: "kg", decimals: 0 },
        { label: "Sand", value: (dry * s) / (1 + s), unit: "m³" },
        { label: "Wet mortar volume", value: wet, unit: "m³" },
      ],
      notes: [`Uses a dry-volume factor of ${DRY_MORTAR_FACTOR}. Rough or porous surfaces use more.`],
    };
  },
  faqs: [
    {
      q: "How many bags of cement for plastering 100 m²?",
      a: "At 12 mm thickness and a 1:4 mix, expect roughly 9 bags of 50 kg for 100 m² before wastage. Enter your own area and thickness above for a tailored figure.",
    },
  ],
};

const BLOCKS: Record<string, { label: string; l: number; h: number }> = {
  "400x200": { label: "400 × 200 mm face", l: 400, h: 200 },
  "600x200": { label: "600 × 200 mm face", l: 600, h: 200 },
  "390x190": { label: "390 × 190 mm face", l: 390, h: 190 },
  "215x65": { label: "Brick 215 × 65 mm face", l: 215, h: 65 },
};

const block: Calculator = {
  slug: "block-calculator",
  name: "Block & Brick Calculator",
  short: "Number of blocks or bricks for a wall, with openings and mortar joints.",
  description:
    "Count the concrete blocks or bricks needed for a wall, deducting doors and windows and allowing for the mortar joint.",
  categoryHint: "blocks",
  inputs: [
    { key: "length", label: "Wall length", unit: "m", type: "number", default: 12, min: 0, step: 0.1 },
    { key: "height", label: "Wall height", unit: "m", type: "number", default: 3, min: 0, step: 0.1 },
    { key: "openings", label: "Openings (doors + windows)", unit: "m²", type: "number", default: 4, min: 0, step: 0.1 },
    {
      key: "size",
      label: "Unit face size",
      type: "select",
      default: "400x200",
      options: Object.entries(BLOCKS).map(([value, b]) => ({ value, label: b.label })),
    },
    { key: "joint", label: "Mortar joint", unit: "mm", type: "number", default: 10, min: 0, step: 1 },
    { ...wasteInput, default: 5 },
  ],
  compute: (v) => {
    const b = BLOCKS[str(v, "size")] ?? BLOCKS["400x200"];
    const joint = Number(v.joint) > 0 ? Number(v.joint) : 0;
    const gross = num(v, "length") * num(v, "height");
    const net = Math.max(gross - num(v, "openings"), 0);
    const face = ((b.l + joint) / 1000) * ((b.h + joint) / 1000);
    const count = net / face;
    return {
      rows: [
        { label: "Units needed (with wastage)", value: Math.ceil(count * (1 + pct(v, "waste"))), unit: "pcs", primary: true, decimals: 0 },
        { label: "Units before wastage", value: Math.ceil(count), unit: "pcs", decimals: 0 },
        { label: "Net wall area", value: net, unit: "m²" },
      ],
      notes: ["Counts face area only. Thickness does not change the count for a single-leaf wall."],
    };
  },
  faqs: [
    {
      q: "How many 400 × 200 blocks per square metre?",
      a: "About 12.5 blocks per m² if joints are ignored, and about 11.6 per m² with a 10 mm mortar joint.",
    },
  ],
};

const tile: Calculator = {
  slug: "tile-calculator",
  name: "Tile Calculator",
  short: "Tiles, boxes and grout allowance for floors and walls.",
  description:
    "Calculate how many tiles and boxes you need for a floor or wall, including grout joints and cutting wastage.",
  categoryHint: "tiles",
  inputs: [
    { key: "length", label: "Room length", unit: "m", type: "number", default: 5, min: 0, step: 0.1 },
    { key: "width", label: "Room width", unit: "m", type: "number", default: 4, min: 0, step: 0.1 },
    { key: "tileL", label: "Tile length", unit: "mm", type: "number", default: 600, min: 0, step: 10 },
    { key: "tileW", label: "Tile width", unit: "mm", type: "number", default: 600, min: 0, step: 10 },
    { key: "gap", label: "Grout joint", unit: "mm", type: "number", default: 3, min: 0, step: 0.5 },
    { key: "perBox", label: "Tiles per box", unit: "pcs", type: "number", default: 4, min: 1, step: 1 },
    { ...wasteInput, default: 10 },
  ],
  compute: (v) => {
    const area = num(v, "length") * num(v, "width");
    const gap = Number(v.gap) > 0 ? Number(v.gap) : 0;
    const one = ((num(v, "tileL") + gap) / 1000) * ((num(v, "tileW") + gap) / 1000);
    const tiles = one > 0 ? Math.ceil((area / one) * (1 + pct(v, "waste"))) : 0;
    const perBox = Math.max(Math.floor(num(v, "perBox")) || 1, 1);
    return {
      rows: [
        { label: "Tiles needed", value: tiles, unit: "pcs", primary: true, decimals: 0 },
        { label: "Boxes to order", value: Math.ceil(tiles / perBox), unit: "boxes", decimals: 0 },
        { label: "Floor area", value: area, unit: "m²" },
      ],
      notes: ["Use 15 percent wastage for diagonal or patterned layouts."],
    };
  },
  faqs: [
    {
      q: "How much extra tile should I buy?",
      a: "Ten percent covers straight layouts and breakage. Diagonal, herringbone or rooms with many cuts need 15 percent. Keep a few spare tiles from the same batch for future repairs.",
    },
  ],
};

const paint: Calculator = {
  slug: "paint-calculator",
  name: "Paint Calculator",
  short: "Litres of paint for walls and ceilings, with openings and coats.",
  description:
    "Estimate how many litres of paint you need for interior or exterior walls, minus doors and windows, for any number of coats.",
  categoryHint: "paint",
  inputs: [
    { key: "perimeter", label: "Total wall length (perimeter)", unit: "m", type: "number", default: 18, min: 0, step: 0.1 },
    { key: "height", label: "Wall height", unit: "m", type: "number", default: 3, min: 0, step: 0.1 },
    { key: "openings", label: "Doors and windows", unit: "m²", type: "number", default: 6, min: 0, step: 0.1 },
    { key: "coats", label: "Number of coats", type: "number", default: 2, min: 1, step: 1 },
    { key: "coverage", label: "Coverage per litre (one coat)", unit: "m²/L", type: "number", default: 10, min: 1, step: 0.5 },
    { ...wasteInput, default: 5 },
  ],
  compute: (v) => {
    const net = Math.max(num(v, "perimeter") * num(v, "height") - num(v, "openings"), 0);
    const coats = Math.max(Math.round(num(v, "coats")) || 1, 1);
    const cov = num(v, "coverage") || 10;
    const litres = ((net * coats) / cov) * (1 + pct(v, "waste"));
    return {
      rows: [
        { label: "Paint needed", value: Math.ceil(litres * 10) / 10, unit: "litres", primary: true },
        { label: "In 18 L drums", value: Math.ceil(litres / 18), unit: "drums", decimals: 0 },
        { label: "Paintable area", value: net, unit: "m²" },
      ],
      notes: ["Check the tin: coverage varies from about 6 to 14 m²/L by product and surface."],
    };
  },
  faqs: [
    {
      q: "How many litres of paint for a 4 × 5 m room?",
      a: "A room with 18 m of wall, 3 m high and about 6 m² of openings has roughly 48 m² to paint. Two coats at 10 m²/L is close to 10 litres including wastage.",
    },
  ],
};

const STEEL_SIZES = [6, 8, 10, 12, 16, 20, 25, 32];
const steel: Calculator = {
  slug: "steel-calculator",
  name: "Steel Rebar Calculator",
  short: "Weight of reinforcement bars by diameter, length and count.",
  description:
    "Convert reinforcement bar diameter, length and quantity into total weight and the number of standard 12 m bars.",
  categoryHint: "steel",
  inputs: [
    {
      key: "dia",
      label: "Bar diameter",
      type: "select",
      default: "12",
      options: STEEL_SIZES.map((d) => ({ value: String(d), label: `${d} mm` })),
    },
    { key: "length", label: "Length of each bar", unit: "m", type: "number", default: 6, min: 0, step: 0.1 },
    { key: "count", label: "Number of bars", type: "number", default: 100, min: 0, step: 1 },
    { ...wasteInput, label: "Lap / cutting allowance", default: 7 },
  ],
  compute: (v) => {
    const d = Number(str(v, "dia")) || 12;
    const metres = num(v, "length") * num(v, "count") * (1 + pct(v, "waste"));
    const kgm = steelKgPerM(d);
    const kg = metres * kgm;
    return {
      rows: [
        { label: "Total weight", value: kg, unit: "kg", primary: true, decimals: 1 },
        { label: "Weight in tonnes", value: kg / 1000, unit: "t", decimals: 3 },
        { label: "Weight per metre", value: kgm, unit: "kg/m", decimals: 3 },
        { label: "Standard 12 m bars", value: Math.ceil(metres / 12), unit: "bars", decimals: 0 },
      ],
      notes: ["Uses the d²/162.2 rule for kg per metre. Confirm against the mill certificate."],
    };
  },
  faqs: [
    {
      q: "What is the weight formula for rebar?",
      a: "Weight per metre in kilograms is the diameter in millimetres squared, divided by 162.2. A 12 mm bar therefore weighs about 0.888 kg per metre.",
    },
  ],
};

const area: Calculator = {
  slug: "area-calculator",
  name: "Area Calculator",
  short: "Area of rectangles, circles and triangles in square metres and square feet.",
  description: "Quickly find the area of a rectangle, circle or triangle and convert it between m² and ft².",
  inputs: [
    {
      key: "shape",
      label: "Shape",
      type: "select",
      default: "rect",
      options: [
        { value: "rect", label: "Rectangle (length × width)" },
        { value: "circle", label: "Circle (diameter in first box)" },
        { value: "tri", label: "Triangle (base × height / 2)" },
      ],
    },
    { key: "a", label: "Length / diameter / base", unit: "m", type: "number", default: 10, min: 0, step: 0.1 },
    { key: "b", label: "Width / height (unused for circle)", unit: "m", type: "number", default: 6, min: 0, step: 0.1 },
  ],
  compute: (v) => {
    const a = num(v, "a");
    const b = num(v, "b");
    const shape = str(v, "shape");
    const m2 = shape === "circle" ? Math.PI * (a / 2) ** 2 : shape === "tri" ? (a * b) / 2 : a * b;
    return {
      rows: [
        { label: "Area", value: m2, unit: "m²", primary: true },
        { label: "Area", value: m2 * 10.7639, unit: "ft²" },
      ],
    };
  },
  faqs: [
    { q: "How do I convert square metres to square feet?", a: "Multiply by 10.7639." },
  ],
};

const quantity: Calculator = {
  slug: "quantity-calculator",
  name: "Material Quantity Calculator",
  short: "Total quantity to order from coverage rate, area and wastage.",
  description:
    "For any material with a known coverage or consumption rate: adhesive, waterproofing, screed, insulation. Enter area, rate and pack size to get the order quantity.",
  inputs: [
    { key: "area", label: "Area", unit: "m²", type: "number", default: 100, min: 0, step: 1 },
    { key: "rate", label: "Consumption per m²", unit: "units/m²", type: "number", default: 4, min: 0, step: 0.1 },
    { key: "pack", label: "Pack size", unit: "units/pack", type: "number", default: 25, min: 0, step: 1 },
    { ...wasteInput, default: 8 },
  ],
  compute: (v) => {
    const total = num(v, "area") * num(v, "rate") * (1 + pct(v, "waste"));
    const pack = num(v, "pack") || 1;
    return {
      rows: [
        { label: "Total needed", value: total, unit: "units", primary: true },
        { label: "Packs to order", value: Math.ceil(total / pack), unit: "packs", decimals: 0 },
        { label: "Order quantity", value: Math.ceil(total / pack) * pack, unit: "units", decimals: 0 },
      ],
    };
  },
  faqs: [
    {
      q: "Where do I find the consumption rate?",
      a: "It is on the manufacturer's data sheet, usually as kg per m² or litres per m² at a stated thickness.",
    },
  ],
};

/** Indicative multipliers per m² of built-up (slab) area for a framed building. */
export const ESTIMATOR_RATES = {
  cementBags: 4.3,
  steelKg: 40,
  sandM3: 0.25,
  aggregateM3: 0.185,
  blocksPcs: 25,
};

const estimator: Calculator = {
  slug: "material-estimator",
  name: "Building Material Estimator",
  short: "Indicative cement, steel, sand, aggregate and block quantities from built-up area.",
  description:
    "A quick budgeting estimate of the main materials for a framed building from its total built-up area and number of floors. Not a substitute for a bill of quantities.",
  inputs: [
    { key: "area", label: "Built-up area per floor", unit: "m²", type: "number", default: 200, min: 0, step: 1 },
    { key: "floors", label: "Number of floors", type: "number", default: 2, min: 1, step: 1 },
    { ...wasteInput, default: 5 },
  ],
  compute: (v) => {
    const total = num(v, "area") * Math.max(Math.round(num(v, "floors")) || 1, 1);
    const f = 1 + pct(v, "waste");
    const r = ESTIMATOR_RATES;
    return {
      rows: [
        { label: "Total built-up area", value: total, unit: "m²" },
        { label: "Cement", value: Math.ceil(total * r.cementBags * f), unit: "bags (50 kg)", primary: true, decimals: 0 },
        { label: "Reinforcement steel", value: (total * r.steelKg * f) / 1000, unit: "tonnes", decimals: 2 },
        { label: "Sand", value: total * r.sandM3 * f, unit: "m³", decimals: 1 },
        { label: "Coarse aggregate", value: total * r.aggregateM3 * f, unit: "m³", decimals: 1 },
        { label: "Blocks (400 × 200)", value: Math.ceil(total * r.blocksPcs * f), unit: "pcs", decimals: 0 },
      ],
      notes: [
        "Rule-of-thumb rates for a typical framed building. Actual use varies 15 to 30 percent with structure, spans and finishes.",
        "Use this for early budgeting, then request quotes against a proper BOQ.",
      ],
    };
  },
  faqs: [
    {
      q: "How accurate is a per-m² estimate?",
      a: "It is good for early budgeting only. Foundations, spans, soil conditions and finishes shift the numbers, so prepare a bill of quantities before ordering.",
    },
  ],
};

export const CALCULATORS: Calculator[] = [concrete, cement, block, tile, paint, steel, area, quantity, estimator];

export function getCalculator(slug: string) {
  return CALCULATORS.find((c) => c.slug === slug);
}

export function defaultValues(c: Calculator): Values {
  return Object.fromEntries(c.inputs.map((i) => [i.key, i.default]));
}

export function formatResult(r: ResultRow) {
  const d = r.decimals ?? (Math.abs(r.value) >= 100 ? 1 : 2);
  return round(r.value, d).toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: d });
}
