import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCtx } from "@/server/access";
import { listMovements, listStock } from "@/server/services/inventory";
import { listWarehouseOptions } from "@/server/services/branches";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { StockForm } from "@/components/dashboard/stock-form";
import { formatDate, formatQty } from "@/lib/utils";
import { roleHas } from "@bmn/config";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string; warehouse?: string }>;
}) {
  const ctx = await requireCtx();
  if (!["SUPPLIER", "STORE"].includes(ctx.orgType) || !roleHas(ctx.role, "inventory.manage"))
    redirect("/dashboard");
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const lowOnly = sp.low === "1";
  const warehouses = await listWarehouseOptions(ctx);
  // Only accept a warehouse id that belongs to this org; anything else means "all locations".
  const warehouseId = warehouses.find((w) => w.id === sp.warehouse)?.id;
  const [rows, all, moves] = await Promise.all([
    listStock(ctx, { q, lowOnly, warehouseId }),
    lowOnly || q ? listStock(ctx, { warehouseId }) : null,
    listMovements(ctx, { take: 20 }),
  ]);
  const catalogue = all ?? rows;
  const lowCount = catalogue.filter((r) => r.low).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock on hand, reserved and available. Marketplace availability updates automatically from these numbers."
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/dashboard/inventory"
          className={`rounded-full border px-3 py-1 ${!lowOnly ? "border-brand-600 text-brand-700" : "border-line"}`}
        >
          All products
        </Link>
        <Link
          href="/dashboard/inventory?low=1"
          className={`rounded-full border px-3 py-1 ${lowOnly ? "border-brand-600 text-brand-700" : "border-line"}`}
        >
          Low stock{lowCount ? ` (${lowCount})` : ""}
        </Link>
        <form className="ml-auto flex gap-2">
          {warehouses.length > 1 ? (
            <select
              name="warehouse"
              defaultValue={warehouseId ?? ""}
              className="h-9 rounded-lg border border-line px-2 text-sm"
              aria-label="Warehouse"
            >
              <option value="">All locations</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          ) : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or SKU"
            className="h-9 rounded-lg border border-line px-3 text-sm"
            aria-label="Search inventory"
          />
        </form>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">On hand</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Reorder at</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.productId}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    {r.sku ? <div className="text-xs text-muted">SKU {r.sku}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatQty(r.onHand)} <span className="text-muted">{r.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatQty(r.reserved)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatQty(r.available)}</td>
                  <td className="px-4 py-3 text-right">{r.reorderLevel ? formatQty(r.reorderLevel) : "—"}</td>
                  <td className="px-4 py-3">
                    {r.available <= 0 ? (
                      <Badge tone="red">Out of stock</Badge>
                    ) : r.low ? (
                      <Badge tone="amber">Low</Badge>
                    ) : (
                      <Badge tone="green">In stock</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={lowOnly ? "Nothing is running low" : "No products yet"}
          body={lowOnly ? "All stock is above its reorder level." : "Add products first, then record stock here."}
        />
      )}

      <StockForm
        products={catalogue.map((r) => ({ id: r.productId, name: r.name, unit: r.unit }))}
        warehouses={warehouses}
        defaultWarehouseId={warehouseId}
      />

      <section>
        <h2 className="mb-2 font-semibold">Recent movements</h2>
        {moves.length ? (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Change</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {moves.map((m) => {
                  const delta = Number(m.onHandDelta.toString());
                  const rdelta = Number(m.reservedDelta.toString());
                  return (
                    <tr key={m.id}>
                      <td className="px-4 py-2">{formatDate(m.createdAt)}</td>
                      <td className="px-4 py-2">{m.product.name}</td>
                      <td className="px-4 py-2 capitalize">{m.type.toLowerCase()}</td>
                      <td className="px-4 py-2 text-right">
                        {delta ? `${delta > 0 ? "+" : ""}${formatQty(delta)}` : `${rdelta > 0 ? "+" : ""}${formatQty(rdelta)} reserved`}{" "}
                        <span className="text-muted">{m.product.unitCode}</span>
                      </td>
                      <td className="px-4 py-2 text-muted">{m.reference ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No movements recorded yet.</p>
        )}
      </section>
    </div>
  );
}
