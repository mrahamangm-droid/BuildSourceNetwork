/** Pure rules for branches, warehouses and stock transfers. */

export const MAX_BRANCHES = 20;
export const MAX_WAREHOUSES_PER_BRANCH = 10;

export type Blocker = string | null;

/**
 * A warehouse may be deleted only when removing it would destroy nothing worth keeping:
 * no ledger history (movements cascade with the warehouse), no stock or reservations, and no
 * order lines pointing at it. Otherwise the user should rename it or leave it empty.
 */
export function warehouseDeleteBlocker(w: {
  movements: number;
  onHandMilli: number;
  reservedMilli: number;
  orderLines: number;
}): Blocker {
  if (w.reservedMilli > 0) return "It still has stock reserved for orders.";
  if (w.onHandMilli > 0) return "It still holds stock. Transfer or issue it first.";
  if (w.orderLines > 0) return "Orders were fulfilled from it, so it must be kept for the record.";
  if (w.movements > 0) return "It has stock history, which would be lost. Keep it for the record.";
  return null;
}

export function transferBlocker(t: {
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
}): Blocker {
  if (!t.fromWarehouseId || !t.toWarehouseId) return "Choose both warehouses.";
  if (t.fromWarehouseId === t.toWarehouseId) return "Choose two different warehouses.";
  if (!Number.isFinite(t.quantity) || t.quantity <= 0) return "Quantity must be greater than zero.";
  return null;
}

/** "Sharjah · Main warehouse" label used in selects; the branch name is omitted if it repeats. */
export function warehouseLabel(branch: string, warehouse: string): string {
  return branch.trim().toLowerCase() === warehouse.trim().toLowerCase()
    ? warehouse
    : `${branch} · ${warehouse}`;
}
