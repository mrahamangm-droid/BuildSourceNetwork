"use client";
import { useActionState } from "react";
import { Badge, Card } from "@/components/ui";
import { FormMessage } from "@/components/forms/shared";
import { orderStockAction, type ActionState } from "@/server/actions";
import { STOCK_STATE_LABEL, type OrderStockState } from "@/lib/order-stock";

type Line = {
  id: string;
  name: string;
  quantity: string;
  unitCode: string;
  state: OrderStockState;
  productId: string;
  productName: string | null;
};

export function OrderStockPanel({
  orderId,
  canReserve,
  lines,
  products,
  warehouses = [],
}: {
  orderId: string;
  canReserve: boolean;
  lines: Line[];
  products: { id: string; name: string; unitCode: string }[];
  warehouses?: { id: string; label: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(orderStockAction, {});
  const anyReserved = lines.some((l) => l.state === "RESERVED");
  const anyOpen = lines.some((l) => l.state === "NONE" || l.state === "RELEASED");
  return (
    <Card>
      <h2 className="font-semibold">Stock for this order</h2>
      <p className="mt-1 text-sm text-muted">
        Link each line to one of your products to hold the stock. Dispatching the order issues reserved goods
        and cancelling it releases them. Units must match; nothing is converted.
      </p>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="orderId" value={orderId} />
        <ul className="divide-y divide-line text-sm">
          {lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 py-2">
              <div className="min-w-48 flex-1">
                <p className="font-medium">{l.name}</p>
                <p className="text-xs text-muted">
                  {l.quantity} {l.unitCode.toLowerCase()}
                </p>
              </div>
              <Badge tone={l.state === "RESERVED" ? "amber" : l.state === "ISSUED" ? "green" : "neutral"}>
                {STOCK_STATE_LABEL[l.state]}
              </Badge>
              {l.state === "NONE" || l.state === "RELEASED" ? (
                <select
                  name={`product_${l.id}`}
                  defaultValue={l.productId}
                  aria-label={`Product for ${l.name}`}
                  className="h-9 max-w-64 rounded-lg border border-line px-2 text-sm"
                  disabled={!canReserve}
                >
                  <option value="">Do not track</option>
                  {products
                    .filter((p) => p.unitCode === l.unitCode)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              ) : (
                <span className="text-xs text-muted">{l.productName ?? "Product removed"}</span>
              )}
            </li>
          ))}
        </ul>
        {canReserve && anyOpen && warehouses.length > 1 ? (
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Reserve from</span>
            <select
              name="warehouseId"
              defaultValue={warehouses[0].id}
              className="h-9 rounded-lg border border-line px-2 text-sm"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!canReserve && anyOpen ? (
          <p className="text-xs text-muted">Stock can be reserved while the order is confirmed or being prepared.</p>
        ) : null}
        <FormMessage state={state} />
        <div className="flex flex-wrap gap-2">
          {canReserve && anyOpen ? (
            <button name="intent" value="reserve" className="h-9 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700">
              Reserve stock
            </button>
          ) : null}
          {anyReserved ? (
            <>
              <button name="intent" value="issue" className="h-9 rounded-lg border border-line px-3 text-sm hover:bg-surface">
                Issue reserved stock now
              </button>
              <button name="intent" value="release" className="h-9 rounded-lg border border-line px-3 text-sm hover:bg-surface">
                Release reservation
              </button>
            </>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
