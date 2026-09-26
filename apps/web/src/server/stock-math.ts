/**
 * Pure stock arithmetic, no I/O. Quantities are handled as integer thousandths so 0.1 + 0.2
 * style float drift can never leak into a ledger. The database also enforces
 * 0 <= reserved <= onHand with a check constraint as a last line of defence.
 */
export type MovementKind = "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "RESERVE" | "RELEASE";
export type Balance = { onHand: number; reserved: number };
export type StockStatusValue = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export class StockError extends Error {}

export const toMilli = (n: number) => Math.round(n * 1000);
export const fromMilli = (m: number) => m / 1000;
export const available = (b: Balance) => b.onHand - b.reserved;

/**
 * Returns the new balance and the signed deltas, or throws StockError.
 * For ADJUSTMENT, `qty` is the counted on-hand quantity (a stock take), not a delta.
 */
export function applyMovement(b: Balance, kind: MovementKind, qty: number) {
  if (!Number.isFinite(qty)) throw new StockError("Enter a valid quantity.");
  if (kind === "ADJUSTMENT") {
    if (qty < 0) throw new StockError("Counted quantity cannot be negative.");
    if (qty < b.reserved)
      throw new StockError(
        `Counted quantity is below the ${fromMilli(b.reserved)} already reserved for orders. Release the reservation first.`,
      );
  } else if (qty <= 0) {
    throw new StockError("Quantity must be greater than zero.");
  }

  let onHand = b.onHand;
  let reserved = b.reserved;
  switch (kind) {
    case "RECEIPT":
      onHand += qty;
      break;
    case "ISSUE":
      if (qty > available(b))
        throw new StockError(
          `Only ${fromMilli(available(b))} available (${fromMilli(b.reserved)} is reserved).`,
        );
      onHand -= qty;
      break;
    case "RESERVE":
      if (qty > available(b))
        throw new StockError(`Only ${fromMilli(available(b))} available to reserve.`);
      reserved += qty;
      break;
    case "RELEASE":
      if (qty > reserved)
        throw new StockError(`Only ${fromMilli(reserved)} is currently reserved.`);
      reserved -= qty;
      break;
    case "ADJUSTMENT":
      onHand = qty;
      break;
  }
  return {
    balance: { onHand, reserved },
    onHandDelta: onHand - b.onHand,
    reservedDelta: reserved - b.reserved,
  };
}

/** Marketplace availability for a product from its total available stock across warehouses. */
export function statusFor(totalAvailable: number, totalReorderLevel: number): StockStatusValue {
  if (totalAvailable <= 0) return "OUT_OF_STOCK";
  if (totalReorderLevel > 0 && totalAvailable <= totalReorderLevel) return "LOW_STOCK";
  return "IN_STOCK";
}

export const isLow = (b: Balance, reorderLevel: number) =>
  reorderLevel > 0 && available(b) <= reorderLevel;
