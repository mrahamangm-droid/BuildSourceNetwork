/** Pure delivery rules: no I/O, shared by the service, the UI and tests. */
export type DeliveryStatusValue = "PENDING" | "ASSIGNED" | "OUT_FOR_DELIVERY" | "DELIVERED";

export const DELIVERY_LABEL: Record<DeliveryStatusValue, string> = {
  PENDING: "Awaiting driver",
  ASSIGNED: "Driver assigned",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};

export const DELIVERY_NEXT: Record<DeliveryStatusValue, DeliveryStatusValue[]> = {
  PENDING: ["ASSIGNED", "OUT_FOR_DELIVERY"],
  ASSIGNED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
};

/** Order statuses in which a supplier may plan or run deliveries. */
export const DELIVERABLE_ORDER_STATUSES = ["CONFIRMED", "PREPARING", "DISPATCHED"] as const;

export type DeliveryState = {
  status: DeliveryStatusValue;
  driverName?: string | null;
  recipientName?: string | null;
};

/** Returns an error message when the move is not allowed, otherwise null. */
export function checkTransition(d: DeliveryState, target: DeliveryStatusValue): string | null {
  if (!DELIVERY_NEXT[d.status].includes(target))
    return `A delivery that is "${DELIVERY_LABEL[d.status]}" cannot move to "${DELIVERY_LABEL[target]}".`;
  if ((target === "ASSIGNED" || target === "OUT_FOR_DELIVERY") && !d.driverName?.trim())
    return "Add a driver name first.";
  if (target === "DELIVERED" && !d.recipientName?.trim())
    return "Enter the name of the person who received the goods.";
  return null;
}

/**
 * Status implied by saving driver details on a delivery that has not left yet:
 * a driver name promotes PENDING to ASSIGNED; removing it demotes ASSIGNED to PENDING.
 */
export function statusAfterDriverEdit(status: DeliveryStatusValue, driverName?: string | null) {
  const has = !!driverName?.trim();
  if (status === "PENDING" && has) return "ASSIGNED" as const;
  if (status === "ASSIGNED" && !has) return "PENDING" as const;
  return status;
}

/** A schedule may be today or later; a date more than a day in the past is almost certainly a typo. */
export function scheduleError(when: Date, now = new Date()): string | null {
  if (Number.isNaN(when.getTime())) return "Enter a valid date and time.";
  if (when.getTime() < now.getTime() - 24 * 3600 * 1000) return "The delivery date is in the past.";
  if (when.getTime() > now.getTime() + 365 * 24 * 3600 * 1000)
    return "The delivery date is too far ahead.";
  return null;
}
