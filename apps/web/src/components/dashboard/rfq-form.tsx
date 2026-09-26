"use client";
import { useActionState, useState } from "react";
import { Card, Field, Input, Select, Textarea, Button } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import { createRfqAction, type ActionState } from "@/server/actions";

type Item = {
  key: number;
  name: string;
  categoryId: string;
  productId: string;
  quantity: string;
  unitCode: string;
  specification: string;
};

export function RfqForm({
  categories,
  units,
  initialItem,
  initialItems,
  initialTitle,
  initialCity,
  supplierOrgId,
  supplierName,
  initialMode,
  defaultCity,
  projectId,
}: {
  categories: { id: string; name: string }[];
  units: { code: string; name: string }[];
  initialItem: { name: string; categoryId: string; productId: string; unitCode: string };
  /** Pre-filled lines (e.g. from a project BOQ). Replaces initialItem when non-empty. */
  initialItems?: Omit<Item, "key">[];
  initialTitle?: string;
  initialCity: string;
  supplierOrgId?: string;
  supplierName?: string;
  initialMode: "get3" | "custom";
  defaultCity: string;
  /** links the new RFQ to a project so the project workspace can track it */
  projectId?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(createRfqAction, {});
  const [items, setItems] = useState<Item[]>(
    initialItems?.length
      ? initialItems.map((x, i) => ({ ...x, key: i + 1 }))
      : [{ key: 1, quantity: "", specification: "", ...initialItem }],
  );
  const [mode, setMode] = useState<"get3" | "custom">(supplierOrgId ? "custom" : initialMode);
  const update = (key: number, patch: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const payload = JSON.stringify(
    items.map((i) => ({
      name: i.name,
      categoryId: i.categoryId,
      productId: i.productId,
      quantity: i.quantity,
      unitCode: i.unitCode,
      specification: i.specification,
    })),
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="items" value={payload} />
      <input type="hidden" name="mode" value={mode} />
      {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
      {supplierOrgId ? <input type="hidden" name="supplierOrgIds" value={supplierOrgId} /> : null}

      {supplierOrgId ? (
        <Card className="bg-brand-50 text-sm">
          This request will be sent directly to{" "}
          <strong>{supplierName ?? "the selected supplier"}</strong>.
        </Card>
      ) : (
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">How many suppliers?</legend>
          {(
            [
              ["get3", "Get 3 Quotes", "We send your request to the 3–5 best-matching suppliers."],
              ["custom", "Wider request", "Send to up to 10 matching suppliers."],
            ] as const
          ).map(([v, t, d]) => (
            <label
              key={v}
              className="flex cursor-pointer gap-3 rounded-lg border border-line p-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50"
            >
              <input
                type="radio"
                checked={mode === v}
                onChange={() => setMode(v)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-semibold">{t}</span>
                <span className="block text-xs text-muted">{d}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <Card className="space-y-4">
        <h2 className="font-semibold">Materials</h2>
        {items.map((it, idx) => (
          <div key={it.key} className="space-y-3 rounded-lg border border-line p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <Field label={`Material ${items.length > 1 ? idx + 1 : ""}`}>
                <Input
                  value={it.name}
                  onChange={(e) => update(it.key, { name: e.target.value })}
                  required
                  placeholder="e.g. Portland cement 50kg"
                />
              </Field>
              <Field label="Category">
                <Select
                  value={it.categoryId}
                  onChange={(e) => update(it.key, { categoryId: e.target.value })}
                >
                  <option value="">Any / not sure</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Quantity">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={it.quantity}
                  onChange={(e) => update(it.key, { quantity: e.target.value })}
                  required
                />
              </Field>
              <Field label="Unit">
                <Select
                  value={it.unitCode}
                  onChange={(e) => update(it.key, { unitCode: e.target.value })}
                  required
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {units.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Specification">
                <Input
                  value={it.specification}
                  onChange={(e) => update(it.key, { specification: e.target.value })}
                  placeholder="Grade, size, brand…"
                />
              </Field>
            </div>
            {items.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))}
              >
                Remove material
              </Button>
            ) : null}
          </div>
        ))}
        {fe(state, "items") ? (
          <p role="alert" className="text-xs text-red-600">
            {fe(state, "items")}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setItems((xs) => [
              ...xs,
              {
                key: Date.now(),
                name: "",
                categoryId: "",
                productId: "",
                quantity: "",
                unitCode: "",
                specification: "",
              },
            ])
          }
        >
          + Add another material
        </Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Delivery</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Delivery location (city)" error={fe(state, "deliveryCity")}>
            <Input name="deliveryCity" defaultValue={initialCity || defaultCity} required />
          </Field>
          <Field label="Required by" error={fe(state, "requiredDate")}>
            <Input name="requiredDate" type="date" />
          </Field>
        </div>
        <Field label="Site address (optional)">
          <Input name="deliveryAddress" />
        </Field>
        <Field label="Title (optional)" hint="Helps you find this request later">
          <Input name="title" maxLength={120} defaultValue={initialTitle ?? ""} />
        </Field>
        <Field label="Notes for suppliers">
          <Textarea name="notes" rows={3} />
        </Field>
      </Card>
      <FormMessage state={state} />
      <SubmitButton size="lg" pending="Sending…">
        {mode === "get3" && !supplierOrgId ? "Get 3 Quotes" : "Send request"}
      </SubmitButton>
    </form>
  );
}
