"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { COMPARE_MAX } from "@/lib/product-compare";
import { toggleCompare, useCompareIds } from "./compare-store";

export function CompareToggle({ id, className }: { id: string; className?: string }) {
  const ids = useCompareIds();
  const [full, setFull] = useState(false);
  const on = ids.includes(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setFull(toggleCompare(id) === "full")}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
        on
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "border-line bg-white text-slate-600 hover:bg-surface",
        className,
      )}
    >
      {on ? "✓ Comparing" : full ? `Max ${COMPARE_MAX} products` : "Compare"}
    </button>
  );
}
