"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/components/cart-api";

export function FeaturedToggle({ productId, featured }: { productId: string; featured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        aria-pressed={featured}
        title={featured ? "Remove from storefront highlights" : "Highlight on your storefront"}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await postJson("/api/products/featured", { productId, on: !featured });
            router.refresh();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        className={
          featured
            ? "rounded-lg bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"
            : "rounded-lg border border-line px-2 py-1 text-xs text-slate-600 hover:bg-surface"
        }
      >
        {featured ? "★ Featured" : "☆ Feature"}
      </button>
      {err ? <p className="mt-1 max-w-[180px] text-xs text-red-700">{err}</p> : null}
    </div>
  );
}
