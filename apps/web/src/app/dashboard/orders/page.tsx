import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/server/access";
import { listOrders } from "@/server/services/orders";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/utils";
import { ORDER_STATUS_LABEL } from "@bmn/config";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const ctx = await requireCtx();
  const orders = await listOrders(ctx);
  const isSupplier = ctx.orgType === "SUPPLIER";
  return (
    <div>
      <PageHeader
        title="Orders"
        description={
          isSupplier ? "Orders from accepted quotes." : "Orders created from quotes you accepted."
        }
      />
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
