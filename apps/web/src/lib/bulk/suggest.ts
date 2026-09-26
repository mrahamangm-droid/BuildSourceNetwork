/** Small fuzzy helpers used for "did you mean" hints in the error report. */
export function levenshtein(a: string, b: string, max = 4): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]!;
    prev[0] = i;
    let rowMin = prev[0]!;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
      rowMin = Math.min(rowMin, prev[j]!);
    }
    if (rowMin > max) return max + 1;
  }
  return prev[b.length]!;
}

/** Closest option (case-insensitive) within a length-scaled distance, or null. */
export function closest(input: string, options: string[]): string | null {
  const t = input.trim().toLowerCase();
  if (!t) return null;
  const limit = Math.max(1, Math.min(3, Math.floor(t.length / 4)));
  let best: string | null = null;
  let bestD = limit + 1;
  for (const o of options) {
    const ol = o.toLowerCase();
    const d = ol.includes(t) || t.includes(ol) ? 1 : levenshtein(t, ol, limit);
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return bestD <= limit ? best : null;
}
