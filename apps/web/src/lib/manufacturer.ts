/** Pure helpers for supplier-kind / factory details. */
import { SUPPLIER_KINDS, type SupplierKind } from "@bmn/config";

export const MAX_CERTIFICATIONS = 12;
export const MAX_CERT_LENGTH = 40;
export const MAX_LEAD_TIME_DAYS = 365;

/** "ISO 9001, ISO 14001 ; CE" -> unique, trimmed, capped list (case-insensitive de-dupe). */
export function parseCertifications(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,;\n]/)) {
    const v = raw.trim().replace(/\s+/g, " ").slice(0, MAX_CERT_LENGTH);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length === MAX_CERTIFICATIONS) break;
  }
  return out;
}

/** Empty string -> null; otherwise a whole number of days in 0..365, else undefined (invalid). */
export function parseLeadTime(input: string): number | null | undefined {
  const t = input.trim();
  if (t === "") return null;
  if (!/^\d{1,3}$/.test(t)) return undefined;
  const n = Number(t);
  return n <= MAX_LEAD_TIME_DAYS ? n : undefined;
}

export function parseKind(input: string): SupplierKind | null {
  return (SUPPLIER_KINDS as readonly string[]).includes(input) ? (input as SupplierKind) : null;
}

export function leadTimeLabel(days: number | null | undefined): string | null {
  if (days == null) return null;
  if (days === 0) return "Ex-stock";
  return days === 1 ? "1 day" : `${days} days`;
}
