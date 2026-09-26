import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/server/access";
import { advanceOrderAction } from "@/server/actions";
import { allowedTransitions, getOrder } from "@/server/services/orders";
import { Alert, Badge, Button, Card, PageHeader } from "@/components/ui";
import { ReviewForm } from "@/components/dashboard/review-form";
import { DeliveryPanel } from "@/components/dashboard/delivery-panel";
import { OrderStockPanel } from "@/components/dashboard/order-stock-panel";
import { getOrderStock } from "@/server/services/order-stock";
import { formatDate, formatMoney, formatQty } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUSES, roleHas } from "@bmn/config";

export const metadata: Metadata = { title: "Order" };

const ACTION_LABEL: Record<string, string> = {
  CONFIRMED: "Confirm order",
  PREPARING: "Start preparing",
  DISPATCHED: "Mark dispatched",
  DELIVERED: "Mark delivered",
  COMPLETED: "Confirm receipt & complete",
  CANCELLED: "Cancel order",
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const ctx = await requireCtx();
  const { id } = await params;
  const sp = await searchParams;
  const order = await getOrder(ctx, id); // scoped to buyer or supplier org
  if (!order) notFound();
  const isBuyer = order.buyerOrgId === ctx.orgId;
  const other = isBuyer ? order.supplierOrg : order.buyerOrg;
  const next = roleHas(ctx.role, "order.manage") ? allowedTransitions(ctx, order) : [];
  const flow = ORDER_STATUSES.filter((s) => s !== "CANCELLED");
  const reached = new Set(order.events.map((e) => e.status));
  const stock =
    !isBuyer && roleHas(ctx.role, "inventory.manage") && order.status !== "COMPLETED"
      ? await getOrderStock(ctx, order.id)
      : null;
  const canReview = isBuyer && order.status === "COMPLETED" && order.reviews.length === 0;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={`Order ${order.number}`}
        description={`${isBuyer ? "Supplier" : "Buyer"}: ${other.name}`}
        action={
          <Badge
            tone={
              order.status === "CANCELLED" ? "red" : order.status === "COMPLETED" ? "green" : "blue"
            }
          >
            {ORDER_STATUS_LABEL[order.status]}
          </Badge>
        }
      />
      {sp.created ? (
        <div className="mb-4">
          <Alert tone="success">
            Quote accepted and order created. The supplier has been notified to confirm it.
          </Alert>
        </div>
      ) : null}
      {sp.error ? (
        <div className="mb-4">
          <Alert tone="error">{sp.error}</Alert>
        </div>
      ) : null}

      <Card className="mb-4">
        <ol className="flex flex-wrap gap-2 text-xs">
          {flow.map((s) => (
            <li
              key={s}
              className={`rounded-full px-3 py-1 ${reached.has(s) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500"}`}
            >
              {ORDER_STATUS_LABEL[s]}
            </li>
          ))}
          {order.status === "CANCELLED" ? (
            <li className="rounded-full bg-red-600 px-3 py-1 text-white">Cancelled</li>
          ) : null}
        </ol>
        {next.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {next.map((s) => (
              <form key={s} action={advanceOrderAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="next" value={s} />
                <Button type="submit" variant={s === "CANCELLED" ? "outline" : "primary"}>
                  {ACTION_LABEL[s]}
                </Button>
              </form>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Unit price</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3">{i.name}</td>
                  <td className="px-4 py-3">
                    {formatQty(i.quantity)} {i.unit.name.toLowerCase()}
                  </td>
                  <td className="px-4 py-3">
                    {formatMoney(i.unitPrice.toString(), order.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(i.lineTotal.toString(), order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-muted">
                  Subtotal
                </td>
                <td className="px-4 py-2 text-right">
                  {formatMoney(order.subtotal.toString(), order.currency)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-muted">
                  Delivery
                </td>
                <td className="px-4 py-2 text-right">
                  {formatMoney(order.deliveryCost.toString(), order.currency)}
                </td>
              </tr>
              <tr className="font-bold">
                <td colSpan={3} className="px-4 py-3 text-right">
                  Total (excl. VAT)
                </td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(order.totalAmount.toString(), order.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
        <div className="space-y-4">
          <Card className="text-sm">
            <h2 className="font-semibold">{isBuyer ? "Supplier" : "Buyer"}</h2>
            <p className="mt-1">{other.name}</p>
            {other.city ? <p className="text-muted">{other.city}</p> : null}
            {other.phone ? <p className="text-muted">{other.phone}</p> : null}
            {other.email ? <p className="text-muted">{other.email}</p> : null}
            {isBuyer && "slug" in other ? (
              <Link
                className="mt-2 inline-block text-brand-700 hover:underline"
                href={`/suppliers/${(other as { slug: string }).slug}`}
              >
                View supplier profile
              </Link>
            ) : null}
          </Card>
          <Card className="text-sm">
            <h2 className="font-semibold">Delivery</h2>
            <p className="mt-1">
              {order.deliveryCity}
              {order.deliveryAddress ? `, ${order.deliveryAddress}` : ""}
            </p>
            <p className="text-muted">Required by {formatDate(order.requiredDate)}</p>
          </Card>
          <Card className="text-sm">
            <h2 className="font-semibold">History</h2>
            <ul className="mt-2 space-y-2">
              {order.events.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{ORDER_STATUS_LABEL[e.status]}</span>
                  <span className="block text-xs text-muted">
                    {formatDate(e.createdAt)}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <DeliveryPanel
          orderId={order.id}
          orderStatus={order.status}
          defaultAddress={[order.deliveryCity, order.deliveryAddress].filter(Boolean).join(", ")}
          canManage={!isBuyer && roleHas(ctx.role, "order.manage")}
          deliveries={order.deliveries.map((d) => ({
            id: d.id,
            status: d.status,
            scheduledAt: d.scheduledAt?.toISOString() ?? null,
            dispatchedAt: d.dispatchedAt?.toISOString() ?? null,
            deliveredAt: d.deliveredAt?.toISOString() ?? null,
            driverName: d.driverName,
            driverPhone: d.driverPhone,
            vehicle: d.vehicle,
            address: d.address,
            recipientName: d.recipientName,
            proofUrl: d.proofUrl,
            proofNote: d.proofNote,
            notes: d.notes,
          }))}
        />
      </div>

      {stock ? (
        <div className="mt-6">
          <OrderStockPanel
            orderId={order.id}
            canReserve={stock.canReserve}
            lines={stock.lines}
            products={stock.products}
            warehouses={stock.warehouses}
          />
        </div>
      ) : null}

      {canReview ? (
        <div className="mt-6">
          <ReviewForm orderId={order.id} />
        </div>
      ) : null}
      {order.reviews[0] ? (
        <Card className="mt-6 text-sm">
          <p className="font-semibold">
            Review: {"★".repeat(order.reviews[0].rating)}
            {"☆".repeat(5 - order.reviews[0].rating)}
          </p>
          {order.reviews[0].comment ? (
            <p className="mt-1 text-slate-700">{order.reviews[0].comment}</p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
