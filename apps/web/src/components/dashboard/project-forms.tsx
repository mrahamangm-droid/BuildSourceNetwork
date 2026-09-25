"use client";
import { useActionState } from "react";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import {
  addBoqItemAction,
  deleteBoqItemAction,
  saveProjectAction,
  starterBoqAction,
  updateBoqItemAction,
  type ActionState,
} from "@/server/actions";
import {
  PROJECT_KINDS,
  PROJECT_KIND_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  STARTER_ASSUMPTIONS,
} from "@/lib/boq";

type ProjectDefaults = {
  id?: string;
  name?: string;
  kind?: string;
  status?: string;
  city?: string | null;
  startDate?: string | null;
  budget?: number | null;
  notes?: string | null;
};

export function ProjectForm({ p }: { p?: ProjectDefaults }) {
  const [state, action] = useActionState<ActionState, FormData>(saveProjectAction, {});
  return (
    <Card>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        {p?.id ? <input type="hidden" name="id" value={p.id} /> : null}
        <Field label="Project name" error={fe(state, "name")}>
          <Input name="name" required maxLength={120} defaultValue={p?.name ?? ""} />
        </Field>
        <Field label="Project type" error={fe(state, "kind")}>
          <Select name="kind" defaultValue={p?.kind ?? "VILLA"}>
            {PROJECT_KINDS.map((k) => (
              <option key={k} value={k}>
                {PROJECT_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" error={fe(state, "status")}>
          <Select name="status" defaultValue={p?.status ?? "PLANNING"}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="City" error={fe(state, "city")}>
          <Input name="city" maxLength={80} defaultValue={p?.city ?? ""} />
        </Field>
        <Field label="Start date" error={fe(state, "startDate")}>
          <Input name="startDate" type="date" defaultValue={p?.startDate ?? ""} />
        </Field>
        <Field label="Materials budget (optional)" error={fe(state, "budget")}>
          <Input name="budget" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={p?.budget ?? ""} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes" error={fe(state, "notes")}>
            <Textarea name="notes" maxLength={2000} defaultValue={p?.notes ?? ""} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <FormMessage state={state} />
          <SubmitButton>{p?.id ? "Save project" : "Create project"}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function AddItemForm({ projectId, sections }: { projectId: string; sections: string[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addBoqItemAction, {});
  return (
    <Card>
      <h3 className="font-semibold">Add a line</h3>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="projectId" value={projectId} />
        <Field label="Section" error={fe(state, "section")}>
          <Input name="section" required maxLength={60} list="boq-sections" placeholder="e.g. Structure" />
          <datalist id="boq-sections">
            {sections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" error={fe(state, "description")}>
            <Input name="description" required maxLength={200} />
          </Field>
        </div>
        <Field label="Unit" error={fe(state, "unit")}>
          <Input name="unit" required maxLength={16} placeholder="m2, m3, kg, bag" />
        </Field>
        <Field label="Quantity" error={fe(state, "quantity")}>
          <Input name="quantity" type="number" inputMode="decimal" min="0" step="0.001" required />
        </Field>
        <Field label="Waste %" error={fe(state, "wastePercent")}>
          <Input name="wastePercent" type="number" inputMode="decimal" min="0" max="100" step="0.5" defaultValue={0} />
        </Field>
        <Field label="Unit rate (optional)" error={fe(state, "unitRate")}>
          <Input name="unitRate" type="number" inputMode="decimal" min="0" step="0.01" />
        </Field>
        <div className="sm:col-span-3">
          <FormMessage state={state} />
          <SubmitButton>Add line</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function StarterForm({ projectId }: { projectId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(starterBoqAction, {});
  return (
    <Card>
      <h3 className="font-semibold">Generate a starter bill</h3>
      <p className="mt-1 text-sm text-muted">
        A rule-based estimate from gross floor area and the project type. It multiplies your area by planning ratios;
        it is not a drawing take-off, so check every quantity before you buy. Lines are added without rates.
      </p>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="projectId" value={projectId} />
        <Field label="Gross floor area (m2)" error={fe(state, "areaM2")}>
          <Input name="areaM2" type="number" inputMode="decimal" min="1" step="0.1" required />
        </Field>
        <Field label="Floors" error={fe(state, "floors")}>
          <Input name="floors" type="number" min="1" max="100" step="1" defaultValue={1} required />
        </Field>
        <div className="flex items-end">
          <SubmitButton>Add starter lines</SubmitButton>
        </div>
        <div className="sm:col-span-3">
          <FormMessage state={state} />
        </div>
      </form>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">Assumptions used</summary>
        <ul className="mt-1 list-disc pl-5">
          {STARTER_ASSUMPTIONS.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

export function BoqRow({
  projectId,
  item,
  cost,
  orderQty,
}: {
  projectId: string;
  item: { id: string; description: string; unit: string; quantity: number; wastePercent: number; unitRate: number | null };
  cost: string;
  orderQty: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateBoqItemAction, {});
  const [delState, delAction] = useActionState<ActionState, FormData>(deleteBoqItemAction, {});
  const err = state.error || delState.error;
  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        <p>{item.description}</p>
        <p className="text-xs text-muted">
          {item.unit} · order {orderQty}
        </p>
        {err ? <p role="alert" className="text-xs text-red-700">{err}</p> : null}
      </td>
      <td className="px-3 py-2" colSpan={3}>
        <form action={action} id={`f-${item.id}`} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="itemId" value={item.id} />
          <input aria-label="Quantity" name="quantity" type="number" step="0.001" min="0" required defaultValue={item.quantity} className="h-8 w-24 rounded border border-line px-2 text-sm" />
          <input aria-label="Waste percent" name="wastePercent" type="number" step="0.5" min="0" max="100" defaultValue={item.wastePercent} className="h-8 w-16 rounded border border-line px-2 text-sm" />
          <input aria-label="Unit rate" name="unitRate" type="number" step="0.01" min="0" placeholder="rate" defaultValue={item.unitRate ?? ""} className="h-8 w-24 rounded border border-line px-2 text-sm" />
          <button type="submit" className="h-8 rounded border border-line px-2 text-xs hover:bg-surface">
            Save
          </button>
        </form>
      </td>
      <td className="px-3 py-2 text-right">{cost}</td>
      <td className="px-3 py-2 text-right">
        <form action={delAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="itemId" value={item.id} />
          <button type="submit" aria-label={`Delete ${item.description}`} className="text-xs text-red-700 hover:underline">
            Delete
          </button>
        </form>
      </td>
    </tr>
  );
}
