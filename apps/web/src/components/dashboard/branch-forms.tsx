"use client";
import { useActionState } from "react";
import { Card, Field, Input, Select } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import {
  addWarehouseAction,
  createBranchAction,
  transferStockAction,
  updateBranchAction,
  type ActionState,
} from "@/server/actions";

type Branch = { id: string; name: string; city: string | null; address: string | null };

/** Create (no `branch`) or edit a branch. */
export function BranchForm({ branch, canEdit }: { branch?: Branch; canEdit: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(
    branch ? updateBranchAction : createBranchAction,
    {},
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      {branch ? <input type="hidden" name="id" value={branch.id} /> : null}
      <fieldset disabled={!canEdit} className="contents">
        <Field label="Branch name" error={fe(state, "name")}>
          <Input name="name" defaultValue={branch?.name ?? ""} required />
        </Field>
        <Field label="City" error={fe(state, "city")}>
          <Input name="city" defaultValue={branch?.city ?? ""} />
        </Field>
        <Field label="Address" error={fe(state, "address")}>
          <Input name="address" defaultValue={branch?.address ?? ""} />
        </Field>
      </fieldset>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
        {canEdit ? <SubmitButton>{branch ? "Save branch" : "Add branch"}</SubmitButton> : null}
      </div>
    </form>
  );
}

export function WarehouseAddForm({ branchId }: { branchId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addWarehouseAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="branchId" value={branchId} />
      <Field label="New warehouse" error={fe(state, "name")}>
        <Input name="name" placeholder="e.g. Yard 2" required />
      </Field>
      <SubmitButton variant="outline">Add warehouse</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function TransferForm({
  products,
  warehouses,
}: {
  products: { id: string; name: string; unit: string }[];
  warehouses: { id: string; label: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(transferStockAction, {});
  if (warehouses.length < 2) return null;
  return (
    <Card>
      <h2 className="font-semibold">Transfer stock between warehouses</h2>
      <p className="mt-1 text-sm text-muted">
        Only available (unreserved) stock can be moved. Both sides are recorded in the stock ledger.
      </p>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Product" error={fe(state, "productId")}>
          <Select name="productId" defaultValue="" required>
            <option value="" disabled>
              Choose…
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.unit})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantity" error={fe(state, "quantity")}>
          <Input name="quantity" type="number" inputMode="decimal" step="0.001" min="0" required />
        </Field>
        <Field label="From" error={fe(state, "fromWarehouseId")}>
          <Select name="fromWarehouseId" defaultValue={warehouses[0].id} required>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="To" error={fe(state, "toWarehouseId")}>
          <Select name="toWarehouseId" defaultValue={warehouses[1].id} required>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note (optional)">
          <Input name="note" maxLength={300} />
        </Field>
        <div className="flex items-end">
          <div className="w-full">
            <FormMessage state={state} />
            <SubmitButton>Transfer</SubmitButton>
          </div>
        </div>
      </form>
    </Card>
  );
}
