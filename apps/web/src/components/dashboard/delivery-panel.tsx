"use client";
import { useActionState, useState } from "react";
import { Badge, Card, Field, Input, Textarea } from "@/components/ui";
import { FormMessage, ImageUpload, SubmitButton, fe } from "@/components/forms/shared";
import { advanceDeliveryAction, saveDeliveryAction, type ActionState } from "@/server/actions";
import {
  DELIVERABLE_ORDER_STATUSES,
  DELIVERY_LABEL,
  type DeliveryStatusValue,
} from "@/lib/delivery-rules";
import { formatDate } from "@/lib/utils";

export type DeliveryView = {
  id: string;
  status: DeliveryStatusValue;
  scheduledAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  driverName: string | null;
  driverPhone: string | null;
  vehicle: string | null;
  address: string | null;
  recipientName: string | null;
  proofUrl: string | null;
  proofNote: string | null;
  notes: string | null;
};

const tone: Record<DeliveryStatusValue, "neutral" | "blue" | "amber" | "green"> = {
  PENDING: "neutral",
  ASSIGNED: "blue",
  OUT_FOR_DELIVERY: "amber",
  DELIVERED: "green",
};

/** datetime-local wants local time without a zone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function DeliveryFields({
  state,
  d,
  defaultAddress,
}: {
  state: ActionState;
  d?: DeliveryView;
  defaultAddress?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Delivery date and time" error={fe(state, "scheduledAt")}>
        <Input
          name="scheduledAt"
          type="datetime-local"
          required
          defaultValue={toLocalInput(d?.scheduledAt ?? null)}
        />
      </Field>
      <Field label="Driver name" error={fe(state, "driverName")}>
        <Input name="driverName" maxLength={80} defaultValue={d?.driverName ?? ""} />
      </Field>
      <Field label="Driver phone" error={fe(state, "driverPhone")}>
        <Input name="driverPhone" type="tel" maxLength={30} defaultValue={d?.driverPhone ?? ""} />
      </Field>
      <Field label="Vehicle / plate" error={fe(state, "vehicle")}>
        <Input name="vehicle" maxLength={60} defaultValue={d?.vehicle ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Delivery address (if different from the order)" error={fe(state, "address")}>
          <Input
            name="address"
            maxLength={300}
            defaultValue={d?.address ?? ""}
            placeholder={defaultAddress}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Notes for the driver / buyer" error={fe(state, "notes")}>
          <Textarea name="notes" rows={2} maxLength={500} defaultValue={d?.notes ?? ""} />
        </Field>
      </div>
    </div>
  );
}

function ScheduleForm({ orderId, defaultAddress }: { orderId: string; defaultAddress: string }) {
  const [state, action] = useActionState<ActionState, FormData>(saveDeliveryAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <DeliveryFields state={state} defaultAddress={defaultAddress} />
      <FormMessage state={state} />
      <SubmitButton>Schedule delivery</SubmitButton>
    </form>
  );
}

function EditForm({ orderId, d }: { orderId: string; d: DeliveryView }) {
  const [state, action] = useActionState<ActionState, FormData>(saveDeliveryAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="deliveryId" value={d.id} />
      <DeliveryFields state={state} d={d} />
      <FormMessage state={state} />
      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}

function StepForm({
  orderId,
  d,
  target,
  label,
}: {
  orderId: string;
  d: DeliveryView;
  target: string;
  label: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(advanceDeliveryAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="deliveryId" value={d.id} />
      <input type="hidden" name="target" value={target} />
      {target === "DELIVERED" ? (
        <div className="space-y-3 rounded-lg border border-line p-3">
          <p className="text-sm font-medium">Proof of delivery</p>
          <Field label="Received by" error={fe(state, "recipientName")}>
            <Input name="recipientName" maxLength={80} required />
          </Field>
          <Field label="Note (optional)" error={fe(state, "proofNote")}>
            <Input name="proofNote" maxLength={500} />
          </Field>
          <ImageUpload name="proofUrl" label="Photo of signed delivery note (optional)" />
        </div>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton>{label}</SubmitButton>
    </form>
  );
}

function DeliveryCard({
  orderId,
  d,
  canManage,
}: {
  orderId: string;
  d: DeliveryView;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const done = d.status === "DELIVERED";
  const nextStep =
    d.status === "PENDING" || d.status === "ASSIGNED"
      ? { target: "OUT_FOR_DELIVERY", label: "Send out for delivery" }
      : d.status === "OUT_FOR_DELIVERY"
        ? { target: "DELIVERED", label: "Mark delivered" }
        : null;
  return (
    <Card className="text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={tone[d.status]}>{DELIVERY_LABEL[d.status]}</Badge>
          <span className="font-medium">
            {d.scheduledAt ? formatDate(d.scheduledAt) : "No date set"}
          </span>
        </div>
        {canManage && !done ? (
          <button
            type="button"
            className="text-brand-700 hover:underline"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Close" : "Edit"}
          </button>
        ) : null}
      </div>
      <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {d.driverName ? (
          <div>
            <dt className="text-muted">Driver</dt>
            <dd>
              {d.driverName}
              {d.driverPhone ? ` · ${d.driverPhone}` : ""}
            </dd>
          </div>
        ) : null}
        {d.vehicle ? (
          <div>
            <dt className="text-muted">Vehicle</dt>
            <dd>{d.vehicle}</dd>
          </div>
        ) : null}
        {d.address ? (
          <div className="sm:col-span-2">
            <dt className="text-muted">Deliver to</dt>
            <dd>{d.address}</dd>
          </div>
        ) : null}
        {d.dispatchedAt ? (
          <div>
            <dt className="text-muted">Left the yard</dt>
            <dd>{formatDate(d.dispatchedAt)}</dd>
          </div>
        ) : null}
        {done ? (
          <div>
            <dt className="text-muted">Delivered</dt>
            <dd>
              {formatDate(d.deliveredAt)}
              {d.recipientName ? ` · received by ${d.recipientName}` : ""}
            </dd>
          </div>
        ) : null}
        {d.notes ? (
          <div className="sm:col-span-2">
            <dt className="text-muted">Notes</dt>
            <dd>{d.notes}</dd>
          </div>
        ) : null}
        {d.proofNote ? (
          <div className="sm:col-span-2">
            <dt className="text-muted">Delivery note</dt>
            <dd>{d.proofNote}</dd>
          </div>
        ) : null}
      </dl>
      {d.proofUrl ? (
        <a
          href={d.proofUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-brand-700 hover:underline"
        >
          View proof of delivery
        </a>
      ) : null}
      {canManage && !done ? (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          {editing ? <EditForm orderId={orderId} d={d} /> : null}
          {nextStep ? (
            <StepForm orderId={orderId} d={d} target={nextStep.target} label={nextStep.label} />
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function DeliveryPanel({
  orderId,
  orderStatus,
  defaultAddress,
  canManage,
  deliveries,
}: {
  orderId: string;
  orderStatus: string;
  defaultAddress: string;
  canManage: boolean;
  deliveries: DeliveryView[];
}) {
  const canSchedule =
    canManage && (DELIVERABLE_ORDER_STATUSES as readonly string[]).includes(orderStatus);
  if (!deliveries.length && !canSchedule) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Deliveries</h2>
      {deliveries.map((d) => (
        <DeliveryCard key={d.id} orderId={orderId} d={d} canManage={canManage} />
      ))}
      {canSchedule ? (
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Schedule a delivery</h3>
          <ScheduleForm orderId={orderId} defaultAddress={defaultAddress} />
        </Card>
      ) : null}
    </section>
  );
}
