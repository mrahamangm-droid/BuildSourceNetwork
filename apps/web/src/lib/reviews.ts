/** Pure review rules: text screening, duplicate detection and rating maths. No database access. */

export const REPORT_REASONS = [
  { value: "SPAM", label: "Spam or advertising" },
  { value: "FAKE", label: "Fake or not a real purchase" },
  { value: "OFFENSIVE", label: "Offensive or abusive" },
  { value: "IRRELEVANT", label: "Not about this product" },
  { value: "OTHER", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export const REPORT_REASON_VALUES = REPORT_REASONS.map((r) => r.value) as [
  ReportReason,
  ...ReportReason[],
];

/**
 * Screens a review for the things that make reviews untrustworthy: links, contact details, and
 * shouting or keyboard-mashing. Returns a message for the author, or null when the text is fine.
 */
export function screenReviewText(...parts: (string | null | undefined)[]): string | null {
  const text = parts.filter(Boolean).join("\n");
  if (!text.trim()) return null;
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(text))
    return "Please remove email addresses from your review.";
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|ae|io|co|info|biz)\b/i.test(text))
    return "Please remove web links from your review.";
  if (/(?:\+?\d[\s().-]?){9,}/.test(text)) return "Please remove phone numbers from your review.";
  if (/(.)\1{7,}/.test(text))
    return "That looks like repeated characters. Please write a real review.";
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 30) {
    const upper = letters.replace(/[^A-Z]/g, "").length;
    if (upper / letters.length > 0.7) return "Please avoid writing in all capitals.";
  }
  return null;
}

/** Normalised form used to spot the same text pasted into several reviews. */
export function normalizeForDuplicate(text: string | null | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim();
}

export type RatingBreakdown = {
  count: number;
  average: number | null;
  rows: { stars: 1 | 2 | 3 | 4 | 5; count: number; percent: number }[];
};

/** Turns per-star counts (only stars that have reviews need to be present) into a breakdown. */
export function ratingBreakdown(counts: Partial<Record<number, number>>): RatingBreakdown {
  let count = 0;
  let sum = 0;
  for (let s = 1; s <= 5; s++) {
    const c = counts[s] ?? 0;
    count += c;
    sum += c * s;
  }
  const rows = ([5, 4, 3, 2, 1] as const).map((stars) => {
    const c = counts[stars] ?? 0;
    return { stars, count: c, percent: count ? Math.round((c / count) * 100) : 0 };
  });
  return { count, average: count ? Math.round((sum / count) * 100) / 100 : null, rows };
}

/** Average of an aggregate, rounded to two decimals, or null when there are no reviews. */
export function roundRating(avg: number | null | undefined): number | null {
  return avg == null ? null : Math.round(avg * 100) / 100;
}
