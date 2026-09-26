import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/server/access";
import { listDeliveries } from "@/server/services/delivery";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { DELIVERY_LABEL, type DeliveryStatusValue } from "@/lib/delivery-rules";
import { formatDate } from "@/lib/utils";
import { roleHas } from "@bmn/config";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Deliveries" };

const tone = { PENDING: "neutral", ASSIGNED: "blue", OUT_FOR_DELIVERY: "amber", DELIVERED: "green" } as const;

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const ctx = await requireCtx();
  if (!roleHas(ctx.role, "order.view")) redirect("/dashboard");
  const sp = await searchParams;
  const showAll = sp.all === "1";
  const rows = await listDeliveries(ctx, { activeOnly: !showAll });
  return (
    <div>
      <PageHeader
        title="Deliveries"
        description="Scheduled and in-progress deliveries across your orders."
      />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/dashboard/deliveries" className={`rounded-full border px-3 py-1 ${!showAll ? "border-brand-600 text-brand-700" : "border-line"}`}>
          Active
        </Link>
        <Link href="/dashboard/deliveries?all=1" className={`rounded-full border px-3 py-1 ${showAll ? "border-brand-600 text-brand-700" : "border-line"}`}>
          All
        </Link>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">{"Counterparty"}</th>
                <th className="px-4 py-3">Deliver to</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((d) => {
                const asSupplier = d.order.supplierOrgId === ctx.orgId;
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3">{d.scheduledAt ? formatDate(d.scheduledAt) : "—"}</td>
                    <td className="px-4 py-3">
                      <Link className="text-brand-700 hover:underline" href={`/dashboard/orders/${d.order.id}`}>
                        {d.order.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{asSupplier ? d.order.buyerOrg.name : d.order.supplierOrg.name}</td>
                    <td className="px-4 py-3">{d.address || [d.order.deliveryCity, d.order.deliveryAddress].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-4 py-3">{d.driverName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={tone[d.status as DeliveryStatusValue]}>{DELIVERY_LABEL[d.status as DeliveryStatusValue]}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No deliveries"
          body="Suppliers schedule deliveries from the order page once an order is confirmed."
        />
      )}
    </div>
  );
}
