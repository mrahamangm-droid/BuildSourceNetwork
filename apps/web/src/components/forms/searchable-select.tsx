"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string; group?: string };

/**
 * Searchable dropdown (combobox) that posts its value like a normal <select>. Type to filter,
 * arrow keys and Enter to pick, Escape to close. Handles lists of hundreds of options.
 */
export function SearchableSelect({
  name,
  options,
  value,
  onChange,
  placeholder = "Choose…",
  disabled,
  required,
  id,
  "aria-label": ariaLabel,
}: {
  name?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) => `${o.group ?? ""} ${o.label}`.toLowerCase().includes(q))
      : options;
    return list.slice(0, 200);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (o: Option) => {
    onChange(o.value);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={box} className="relative">
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-activedescendant={open && shown[active] ? `${uid}-o${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : (selected?.label ?? "")}
        className={cn(
          "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 disabled:bg-surface disabled:text-muted",
          !selected && !open && "text-muted",
        )}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            const o = shown[active];
            if (o) pick(o);
          } else if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-white py-1 text-sm shadow-lg"
        >
          {shown.length ? (
            shown.map((o, i) => (
              <li
                key={o.value}
                id={`${uid}-o${i}`}
                role="option"
                aria-selected={o.value === value}
                className={cn(
                  "cursor-pointer px-3 py-1.5",
                  i === active && "bg-brand-50",
                  o.value === value && "font-medium",
                )}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
              >
                {o.label}
                {o.group ? <span className="ml-2 text-xs text-muted">{o.group}</span> : null}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-muted">No matches</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
