import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/server/access";
import { listOrders, regularMaterialsFor } from "@/server/services/orders";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { formatDate, formatMoney, formatQty } from "@/lib/utils";
import { ORDER_STATUS_LABEL } from "@bmn/config";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const ctx = await requireCtx();
  const orders = await listOrders(ctx);
  const isSupplier = ctx.orgType === "SUPPLIER";
  const regular = isSupplier ? [] : await regularMaterialsFor(ctx);
  return (
    <div>
      <PageHeader
        title="Orders"
        description={
          isSupplier ? "Orders from accepted quotes." : "Orders created from quotes you accepted."
        }
      />
      {regular.length ? (
        <section className="mb-6" aria-labelledby="regular-h">
          <h2 id="regular-h" className="text-lg font-semibold">
            Regular materials
          </h2>
          <p className="mt-1 text-sm text-muted">
            What you buy most often, from your own order history. Reorder in two clicks.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {regular.map((m) => {
              const base = m.productId
                ? `/dashboard/rfqs/new?productId=${m.productId}`
                : `/dashboard/rfqs/new?material=${encodeURIComponent(m.name)}`;
              return (
                <Card key={m.key} className="flex flex-col gap-1 p-4 text-sm">
                  <p className="font-semibold leading-snug">{m.name}</p>
                  <p className="text-xs text-muted">
                    Ordered {m.orders}× · last {formatQty(m.lastQuantity)}{" "}
                    {m.unitCode.toLowerCase()} from {m.supplierName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <LinkButton href={base} size="sm" variant="outline">
                      Get quotes
                    </LinkButton>
                    <LinkButton
                      href={`${base}&supplier=${m.supplierOrgId}&mode=custom`}
                      size="sm"
                      variant="ghost"
                    >
                      Same supplier
                    </LinkButton>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
      {orders.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">{isSupplier ? "Buyer" : "Supplier"}</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-brand-700 hover:underline"
                      href={`/dashboard/orders/${o.id}`}
                    >
                      {o.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{isSupplier ? o.buyerOrg.name : o.supplierOrg.name}</td>
                  <td className="px-4 py-3">{o._count.items}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatMoney(o.totalAmount.toString(), o.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        o.status === "COMPLETED" || o.status === "DELIVERED"
                          ? "green"
                          : o.status === "CANCELLED"
                            ? "red"
                            : "blue"
                      }
                    >
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No orders yet"
          body={
            isSupplier
              ? "When a buyer accepts your quote, the order appears here."
              : "Accept a supplier's quote to create your first order."
          }
        />
      )}
    </div>
  );
}
