"use client";
import Link from "next/link";
import { clearCompare, useCompareIds } from "./compare-store";

/** Slim bar at the bottom of the screen once the visitor has picked products to compare. */
export function CompareBar() {
  const ids = useCompareIds();
  if (!ids.length) return null;
  return (
    <div
      role="region"
      aria-label="Product comparison"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 py-3 shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm">
        <p>
          <span className="font-semibold">{ids.length}</span> product{ids.length === 1 ? "" : "s"}{" "}
          selected to compare
          {ids.length < 2 ? <span className="text-muted"> — pick at least one more</span> : null}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={clearCompare} className="text-muted hover:underline">
            Clear
          </button>
          {ids.length >= 2 ? (
            <Link
              href={`/compare?ids=${ids.join(",")}`}
              className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700"
            >
              Compare now
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
