"use client";
import { useRouter } from "next/navigation";
import { setCompare } from "./compare-store";

export function CompareRemove({ ids, id }: { ids: string[]; id: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-xs text-muted hover:text-red-700 hover:underline"
      onClick={() => {
        const next = ids.filter((x) => x !== id);
        setCompare(next);
        router.push(next.length ? `/compare?ids=${next.join(",")}` : "/compare");
      }}
    >
      Remove
    </button>
  );
}

/** Keeps the bottom bar in step with the URL when someone opens a shared comparison link. */
export function CompareSync({ ids }: { ids: string[] }) {
  return (
    <button
      type="button"
      className="text-sm text-brand-700 hover:underline"
      onClick={() => setCompare(ids)}
    >
      Keep these selected while I browse
    </button>
  );
}
