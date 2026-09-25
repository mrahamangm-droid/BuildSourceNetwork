/**
 * Fixed-window in-memory rate limiter. Good for a single instance and for tests; on Vercel each
 * lambda has its own memory, so swap the store for Upstash/Redis before relying on it at scale
 * (the `hit` signature is the only thing callers depend on).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function hit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return { ok: true, retryAfterSec: 0 };
  }
  b.count += 1;
  return { ok: b.count <= limit, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

export function resetRateLimits() {
  buckets.clear();
}
