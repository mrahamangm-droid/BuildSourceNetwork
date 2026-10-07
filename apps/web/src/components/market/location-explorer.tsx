"use client";

import { useState } from "react";
import { mapEmbedSrc, mapLinkHref } from "@/components/market/map-embed";

export type LocationItem = {
  /** Map search text, e.g. "Dubai, United Arab Emirates" */
  query: string;
  city: string;
  suppliers: number;
  shops: number;
};

/** City picker that re-centres a Google map. Lazy iframe, keyboard and screen-reader friendly. */
export function LocationExplorer({ items }: { items: LocationItem[] }) {
  const [active, setActive] = useState(0);
  const current = items[active] ?? items[0];
  if (!current) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Choose a city">
          {items.map((it, i) => (
            <li key={it.query}>
              <button
                type="button"
                aria-pressed={i === active}
                onClick={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  i === active
                    ? "border-brand-600 bg-brand-50"
                    : "border-line bg-white hover:border-brand-600"
                }`}
              >
                <span className="font-semibold">{it.city}</span>
                <span className="text-xs text-slate-600">
                  {it.suppliers} {it.suppliers === 1 ? "supplier" : "suppliers"} · {it.shops}{" "}
                  {it.shops === 1 ? "shop" : "shops"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <iframe
            key={current.query}
            title={`Map of ${current.city}`}
            src={mapEmbedSrc(current.query, 11)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            className="aspect-[4/3] w-full border-0 sm:aspect-[16/10]"
          />
        </div>
        <p className="mt-2 text-sm">
          <a
            className="text-brand-700 hover:underline"
            href={mapLinkHref(current.query)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open {current.city} in Google Maps
          </a>
        </p>
      </div>
    </div>
  );
}
