"use client";
import { useState } from "react";

/** Five-star picker that posts its value like a normal field. */
export function StarInput({ name, defaultValue = 0 }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1">
      <input type="hidden" name={name} value={value || ""} />
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
          onClick={() => setValue(i)}
          className={`text-3xl leading-none ${i <= value ? "text-amber-500" : "text-slate-300"} hover:text-amber-400`}
        >
          ★
        </button>
      ))}
      <span className="ml-2 text-sm text-muted">{value ? `${value} of 5` : "Choose a rating"}</span>
    </div>
  );
}
