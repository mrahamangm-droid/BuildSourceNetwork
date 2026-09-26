/** Supply-chain position of an organization, from data we actually hold (org type + supplier kind). */
export type ChainStep = "MANUFACTURER" | "SUPPLIER" | "STORE" | "BUYER";
export const CHAIN: { key: ChainStep; label: string }[] = [
  { key: "MANUFACTURER", label: "Manufacturer" },
  { key: "SUPPLIER", label: "Supplier" },
  { key: "STORE", label: "Store" },
  { key: "BUYER", label: "Contractor / Developer" },
];

export function chainStepFor(org: { type: string; supplierKind?: string | null }): ChainStep {
  if (org.type === "SUPPLIER")
    return org.supplierKind === "MANUFACTURER" ? "MANUFACTURER" : "SUPPLIER";
  if (org.type === "STORE") return "STORE";
  return "BUYER";
}

/** Distributors and wholesalers sit in the "Supplier" step; say what they actually are. */
export function chainRoleLabel(org: { type: string; supplierKind?: string | null }): string {
  if (org.type === "SUPPLIER") {
    const k = org.supplierKind;
    return k === "MANUFACTURER"
      ? "Manufacturer"
      : k === "DISTRIBUTOR"
        ? "Distributor"
        : k === "WHOLESALER"
          ? "Wholesaler"
          : "Supplier";
  }
  return org.type === "STORE" ? "Store" : "Contractor / Developer";
}
