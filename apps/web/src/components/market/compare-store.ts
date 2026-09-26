"use client";
import { useSyncExternalStore } from "react";
import { COMPARE_MAX } from "@/lib/product-compare";

const KEY = "bsn-compare";
const EVT = "bsn-compare-change";

function read(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
function write(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, ids.join(","));
  } catch {
    /* storage unavailable: the selection just will not persist */
  }
  window.dispatchEvent(new Event(EVT));
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
}

/** The saved comparison ids. The snapshot is a string so React sees a stable value. */
export function useCompareIds(): string[] {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return raw ? raw.split(",").filter(Boolean) : [];
}

export function toggleCompare(id: string): "added" | "removed" | "full" {
  const cur = read().split(",").filter(Boolean);
  if (cur.includes(id)) {
    write(cur.filter((x) => x !== id));
    return "removed";
  }
  if (cur.length >= COMPARE_MAX) return "full";
  write([...cur, id]);
  return "added";
}

export const clearCompare = () => write([]);
export const setCompare = (ids: string[]) => write(ids.slice(0, COMPARE_MAX));
