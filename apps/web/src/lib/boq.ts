/**
 * Bill of quantities maths. Pure, no I/O.
 * Money is integer cents; quantities are rounded to 3 decimals.
 *
 * The starter generator is a rule-based estimator, not machine learning: it multiplies
 * the gross floor area by transparent planning ratios. Ratios are rough early-stage
 * values meant to be edited against drawings; they are not a substitute for a QS take-off.
 */

export const toCents = (n: number) => Math.round(n * 100);
export const fromCents = (c: number) => c / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export const PROJECT_KINDS = ["VILLA", "APARTMENT_BUILDING", "WAREHOUSE", "OTHER"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];
export const PROJECT_KIND_LABEL: Record<ProjectKind, string> = {
  VILLA: "Villa / house",
  APARTMENT_BUILDING: "Apartment building",
  WAREHOUSE: "Warehouse / industrial shed",
  OTHER: "Other",
};

export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"] as const;
export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatusValue, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};

export const MAX_ITEMS_PER_PROJECT = 300;

export type BoqLine = {
  quantity: number;
  wastePercent: number;
  unitRate: number | null;
};

/** Quantity to buy once waste is added. */
export const orderQty = (l: Pick<BoqLine, "quantity" | "wastePercent">) =>
  r3(l.quantity * (1 + l.wastePercent / 100));

/** Cost in cents, or null while no rate has been entered. */
export function lineCostCents(l: BoqLine): number | null {
  if (l.unitRate === null) return null;
  return Math.round(orderQty(l) * toCents(l.unitRate));
}

export type SectionSummary<T> = {
  section: string;
  items: T[];
  subtotalCents: number;
  unpriced: number;
};

export type BoqSummary<T> = {
  sections: SectionSummary<T>[];
  totalCents: number;
  unpriced: number;
  itemCount: number;
  /** budget - total, in cents; null when no budget is set. */
  varianceCents: number | null;
  /** total as a share of the budget, one decimal; null when no budget is set. */
  budgetUsedPercent: number | null;
};

export function summarize<T extends BoqLine & { section: string }>(
  items: T[],
  budget: number | null,
): BoqSummary<T> {
  const order: string[] = [];
  const bySection = new Map<string, SectionSummary<T>>();
  let total = 0;
  let unpriced = 0;
  for (const it of items) {
    let s = bySection.get(it.section);
    if (!s) {
      s = { section: it.section, items: [], subtotalCents: 0, unpriced: 0 };
      bySection.set(it.section, s);
      order.push(it.section);
    }
    s.items.push(it);
    const c = lineCostCents(it);
    if (c === null) {
      s.unpriced++;
      unpriced++;
    } else {
      s.subtotalCents += c;
      total += c;
    }
  }
  const budgetCents = budget === null ? null : toCents(budget);
  return {
    sections: order.map((k) => bySection.get(k)!),
    totalCents: total,
    unpriced,
    itemCount: items.length,
    varianceCents: budgetCents === null ? null : budgetCents - total,
    budgetUsedPercent:
      budgetCents === null || budgetCents === 0
        ? null
        : Math.round((total / budgetCents) * 1000) / 10,
  };
}

// ---------------------------------------------------------------- starter BOQ

type Ratios = {
  concreteM3PerM2: number; // structural concrete per m2 of gross floor area
  rebarKgPerM3: number; // reinforcement per m3 of concrete
  wallM2PerM2: number; // blockwork wall area per m2 of gross floor area
};

const RATIOS: Record<Exclude<ProjectKind, "OTHER">, Ratios> = {
  VILLA: { concreteM3PerM2: 0.32, rebarKgPerM3: 110, wallM2PerM2: 1.3 },
  APARTMENT_BUILDING: { concreteM3PerM2: 0.38, rebarKgPerM3: 120, wallM2PerM2: 1.1 },
  WAREHOUSE: { concreteM3PerM2: 0.22, rebarKgPerM3: 80, wallM2PerM2: 0.5 },
};

export type StarterItem = {
  section: string;
  description: string;
  unit: string;
  quantity: number;
  wastePercent: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export const STARTER_ASSUMPTIONS = [
  "Formwork is taken as 6 m2 per m3 of concrete.",
  "Excavation is footprint x 1.5 m deep; blinding is 0.1 m thick over the footprint.",
  "Plaster covers both faces of blockwork; painting covers plastered walls plus ceilings (0.9 m2 per m2 of floor).",
  "Floor finish covers 85% of gross floor area.",
];

/**
 * Starter bill for a building. Returns [] for kind OTHER or invalid input, so callers
 * can show a clear message instead of a bogus estimate.
 */
export function starterBoq(kind: ProjectKind, grossAreaM2: number, floors: number): StarterItem[] {
  if (kind === "OTHER") return [];
  if (!(grossAreaM2 > 0) || !Number.isFinite(grossAreaM2) || grossAreaM2 > 1_000_000) return [];
  if (!Number.isInteger(floors) || floors < 1 || floors > 100) return [];
  const k = RATIOS[kind];
  const footprint = grossAreaM2 / floors;
  const concrete = grossAreaM2 * k.concreteM3PerM2;
  const wall = grossAreaM2 * k.wallM2PerM2;
  const it = (
    section: string,
    description: string,
    unit: string,
    quantity: number,
    wastePercent: number,
  ): StarterItem => ({ section, description, unit, quantity: r1(quantity), wastePercent });
  return [
    it("Substructure", "Excavation", "m3", footprint * 1.5, 0),
    it("Substructure", "Blinding concrete", "m3", footprint * 0.1, 3),
    it("Structure", "Reinforced concrete (footings, columns, slabs)", "m3", concrete, 3),
    it("Structure", "Reinforcement steel", "kg", concrete * k.rebarKgPerM3, 5),
    it("Structure", "Formwork", "m2", concrete * 6, 0),
    it("Masonry", "Concrete blockwork", "m2", wall, 5),
    it("Finishes", "Cement plaster (both faces)", "m2", wall * 2, 5),
    it("Finishes", "Floor tiling", "m2", grossAreaM2 * 0.85, 10),
    it("Finishes", "Interior and exterior painting", "m2", wall * 2 + grossAreaM2 * 0.9, 5),
  ];
}

// ------------------------------------------------------------------------ CSV

/** Neutralises spreadsheet formula injection and quotes fields that need it. */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function boqCsv(
  items: (BoqLine & { section: string; description: string; unit: string })[],
): string {
  const head = [
    "Section",
    "Description",
    "Unit",
    "Quantity",
    "Waste %",
    "Order quantity",
    "Unit rate",
    "Cost",
  ];
  const rows = items.map((i) => {
    const c = lineCostCents(i);
    return [
      i.section,
      i.description,
      i.unit,
      i.quantity,
      i.wastePercent,
      orderQty(i),
      i.unitRate === null ? "" : i.unitRate.toFixed(2),
      c === null ? "" : fromCents(c).toFixed(2),
    ]
      .map(csvCell)
      .join(",");
  });
  return [head.join(","), ...rows].join("\r\n") + "\r\n";
}
