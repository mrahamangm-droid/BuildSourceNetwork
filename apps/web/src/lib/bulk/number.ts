/**
 * Forgiving number parsing for spreadsheets. Real supplier files contain "1,250.50", "1.250,50",
 * "AED 12", "1 200 000", "1,00,000" (Indian grouping), "2.5k", "1.2M", Arabic-Indic digits and
 * numbers already typed as numbers. Returns null for anything that is not clearly a number, so
 * bad cells are reported rather than guessed at.
 */
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

function latinDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (ch) => {
    const i = ARABIC_INDIC.indexOf(ch);
    return String(i >= 0 ? i : PERSIAN.indexOf(ch));
  });
}

export type ParsedNumber = { value: number } | { error: string };

export function parseFlexibleNumber(
  raw: string | number | null | undefined,
  opts: { allowSuffix?: boolean } = {},
): ParsedNumber | null {
  if (raw == null) return null;
  if (typeof raw === "number")
    return Number.isFinite(raw) ? { value: raw } : { error: "Not a number" };
  let t = latinDigits(String(raw)).replace(/[   ]/g, " ").trim();
  if (!t) return null;
  // Currency codes and symbols, percent signs and the words "approx"/"~" are noise around a number.
  t = t
    .replace(/^(?:aed|usd|sar|qar|omr|kwd|bhd|eur|gbp|inr|dhs?|د\.إ|\$|€|£|₹)\s*/i, "")
    .replace(/\s*(?:aed|usd|sar|qar|omr|kwd|bhd|eur|gbp|inr|dhs?|\/-)$/i, "")
    .replace(/%$/, "")
    .trim();
  let mult = 1;
  if (opts.allowSuffix) {
    const m = /^(.*?)(?:\s*)([kKmM])$/.exec(t);
    if (m && /\d/.test(m[1]!)) {
      mult = m[2]!.toLowerCase() === "k" ? 1e3 : 1e6;
      t = m[1]!.trim();
    }
  }
  if (/^\(.*\)$/.test(t) || t.startsWith("-")) return { error: "Negative numbers are not allowed" };
  t = t.replace(/^\+/, "");
  if (!/^[\d.,' ]+$/.test(t) || !/\d/.test(t)) return { error: "Not a number" };
  t = t.replace(/['\s]/g, ""); // space and apostrophe thousands separators
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  let normal: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // Whichever separator comes last is the decimal point.
    normal = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const groups = t.split(",");
    const groupedThousands =
      groups.length > 2 || /^\d{1,3}(,\d{3})+$/.test(t) || /^\d{1,2}(,\d{2})*,\d{3}$/.test(t);
    // "1,250" and "1,00,000" are thousands; "12,5" and "0,75" are decimals.
    normal = groupedThousands ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (lastDot >= 0) {
    const groups = t.split(".");
    // "1.250.000" is thousands; a lone "1.250" is treated as a decimal (the common spreadsheet meaning).
    normal =
      groups.length > 2 && groups.slice(1).every((g) => g.length === 3) ? t.replace(/\./g, "") : t;
  } else normal = t;
  if ((normal.match(/\./g) ?? []).length > 1) return { error: "Not a number" };
  const n = Number(normal) * mult;
  if (!Number.isFinite(n)) return { error: "Not a number" };
  return { value: Math.round(n * 1e6) / 1e6 };
}
