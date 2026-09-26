"use client";
import { useEffect, useState } from "react";
import { Field } from "@/components/ui";
import { SearchableSelect, type Option } from "./searchable-select";

type Sub = { id: string; name: string; types: { id: string; name: string }[] };
export type CategoryOption = { id: string; name: string; group?: string };

/**
 * Category → Subcategory → Product type, each searchable and each depending on the one before.
 * Posts categoryId, subcategoryId and productTypeId. Subcategory and product type are optional.
 */
export function TaxonomyPicker({
  categories,
  initial,
  errors = {},
}: {
  categories: CategoryOption[];
  initial: { categoryId?: string; subcategoryId?: string | null; productTypeId?: string | null };
  errors?: Partial<Record<"categoryId" | "subcategoryId" | "productTypeId", string>>;
}) {
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const [subId, setSubId] = useState(initial.subcategoryId ?? "");
  const [typeId, setTypeId] = useState(initial.productTypeId ?? "");
  const [byCategory, setByCategory] = useState<Record<string, Sub[]>>({});
  const subs = byCategory[categoryId] ?? [];
  const loading = !!categoryId && !byCategory[categoryId];

  useEffect(() => {
    if (!categoryId || byCategory[categoryId]) return;
    const ctl = new AbortController();
    fetch(`/api/taxonomy?category=${encodeURIComponent(categoryId)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : { subcategories: [] }))
      .then((j: { subcategories: Sub[] }) =>
        setByCategory((prev) => ({ ...prev, [categoryId]: j.subcategories })),
      )
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setByCategory((prev) => ({ ...prev, [categoryId]: [] }));
      });
    return () => ctl.abort();
  }, [categoryId, byCategory]);

  const catOptions: Option[] = categories.map((c) => ({
    value: c.id,
    label: c.name,
    group: c.group,
  }));
  const subOptions: Option[] = subs.map((s) => ({ value: s.id, label: s.name }));
  const types = subs.find((s) => s.id === subId)?.types ?? [];
  const typeOptions: Option[] = types.map((t) => ({ value: t.id, label: t.name }));

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Category" error={errors.categoryId}>
        <SearchableSelect
          name="categoryId"
          required
          options={catOptions}
          value={categoryId}
          placeholder="Search categories…"
          onChange={(v) => {
            setCategoryId(v);
            setSubId("");
            setTypeId("");
          }}
        />
      </Field>
      <Field label="Subcategory (optional)" error={errors.subcategoryId}>
        <SearchableSelect
          name="subcategoryId"
          options={subOptions}
          value={subId}
          disabled={!categoryId || (!loading && !subOptions.length)}
          placeholder={
            loading ? "Loading…" : categoryId ? "Search subcategories…" : "Pick a category first"
          }
          onChange={(v) => {
            setSubId(v);
            setTypeId("");
          }}
        />
      </Field>
      <Field label="Product type (optional)" error={errors.productTypeId}>
        <SearchableSelect
          name="productTypeId"
          options={typeOptions}
          value={typeId}
          disabled={!subId || !typeOptions.length}
          placeholder={subId ? "Search product types…" : "Pick a subcategory first"}
          onChange={setTypeId}
        />
      </Field>
    </div>
  );
}
