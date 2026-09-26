import type { RatingBreakdown } from "@/lib/reviews";

/** Read-only star display. The text alternative carries the exact value for screen readers. */
export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span
      className={`inline-flex items-center ${className}`}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className={i <= filled ? "text-amber-500" : "text-slate-300"}
        >
          {i <= filled ? "★" : "☆"}
        </span>
      ))}
    </span>
  );
}

/** Compact "★★★★☆ 4.2 (18)" line for cards; renders nothing when there are no reviews. */
export function RatingLine({ avg, count }: { avg: number | null; count: number }) {
  if (!count || avg == null) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-muted">
      <Stars value={avg} />
      <span>
        {avg.toFixed(1)} ({count})
      </span>
    </p>
  );
}

/** Average plus the 5-to-1 star histogram. */
export function RatingSummary({ breakdown }: { breakdown: RatingBreakdown }) {
  if (!breakdown.count || breakdown.average == null)
    return <p className="text-sm text-muted">No reviews yet.</p>;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div>
        <p className="text-4xl font-bold">{breakdown.average.toFixed(1)}</p>
        <Stars value={breakdown.average} className="text-lg" />
        <p className="text-xs text-muted">
          {breakdown.count} review{breakdown.count === 1 ? "" : "s"}
        </p>
      </div>
      <ul className="min-w-[200px] flex-1 space-y-1 text-xs" aria-label="Rating breakdown">
        {breakdown.rows.map((r) => (
          <li key={r.stars} className="flex items-center gap-2">
            <span className="w-8 text-right">{r.stars} ★</span>
            <span className="h-2 flex-1 overflow-hidden rounded bg-slate-200">
              <span className="block h-full bg-amber-500" style={{ width: `${r.percent}%` }} />
            </span>
            <span className="w-8 text-muted">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
