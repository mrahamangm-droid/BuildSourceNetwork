"use client";
import { Select } from "@/components/ui";

/** Category filter grouped by department. Changing it clears the dependent subcategory/type filters. */
export function CategoryFilterSelect({
  groups,
  defaultValue,
}: {
  groups: { department: string; items: { slug: string; name: string }[] }[];
  defaultValue: string;
}) {
  return (
    <Select
      id="category"
      name="category"
      defaultValue={defaultValue}
      onChange={(e) => {
        const form = e.currentTarget.form;
        for (const n of ["sub", "type"]) {
          const el = form?.elements.namedItem(n);
          if (el instanceof HTMLSelectElement) el.value = "";
        }
      }}
    >
      <option value="">All categories</option>
      {groups.map((g) => (
        <optgroup key={g.department} label={g.department}>
          {g.items.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
