import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/server/access";
import { expireStale, listBuyerRfqs, listSupplierInbox } from "@/server/services/rfq";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "RFQs" };

const RFQ_TONE = {
  OPEN: "blue",
  ACCEPTED: "green",
  CLOSED: "neutral",
  EXPIRED: "neutral",
  CANCELLED: "red",
} as const;
const REC_TONE = {
  SENT: "blue",
  VIEWED: "amber",
  RESPONDED: "green",
  DECLINED: "neutral",
  EXPIRED: "neutral",
} as const;
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default async function RfqsPage() {
  const ctx = await requireCtx();
  await expireStale();
  if (ctx.orgType === "SUPPLIER") {
    const inbox = await listSupplierInbox(ctx);
    return (
      <div>
        <PageHeader
          title="RFQ inbox"
          description="Quote requests sent to your business. Respond with a price to win the order."
        />
        {inbox.length ? (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">RFQ</th>
                  <th className="px-4 py-3">Materials</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Deliver to</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {inbox.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <Link
                        className="font-medium text-brand-700 hover:underline"
                        href={`/dashboard/rfqs/${r.rfqId}`}
                      >
                        {r.rfq.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{r.rfq.items.map((i) => i.name).join(", ")}</td>
                    <td className="px-4 py-3">{r.rfq.buyerOrg.name}</td>
                    <td className="px-4 py-3">{r.rfq.deliveryCity}</td>
                    <td className="px-4 py-3">
                      <Badge tone={REC_TONE[r.status]}>{label(r.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No quote requests yet"
            body="When a buyer requests quotes for materials you sell, it shows up here. Keep your products and delivery areas up to date to be matched."
          />
        )}
      </div>
    );
  }
  const rfqs = await listBuyerRfqs(ctx);
  return (
    <div>
      <PageHeader
        title="My RFQs"
        description="Track supplier responses and compare quotes."
        action={<LinkButton href="/dashboard/rfqs/new">Request Quotes</LinkButton>}
      />
      {rfqs.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">RFQ</th>
                <th className="px-4 py-3">Materials</th>
                <th className="px-4 py-3">Suppliers</th>
                <th className="px-4 py-3">Quotes</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rfqs.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-brand-700 hover:underline"
                      href={`/dashboard/rfqs/${r.id}`}
                    >
                      {r.number}
                    </Link>
                    {r.title ? <p className="text-xs text-muted">{r.title}</p> : null}
                  </td>
                  <td className="px-4 py-3">{r.items.map((i) => i.name).join(", ")}</td>
                  <td className="px-4 py-3">{r.recipients.length}</td>
                  <td className="px-4 py-3">{r._count.quotes}</td>
                  <td className="px-4 py-3">
                    <Badge tone={RFQ_TONE[r.status]}>{label(r.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No requests yet"
          body="Send one request and get prices from several suppliers."
          action={<LinkButton href="/dashboard/rfqs/new">Get 3 Quotes</LinkButton>}
        />
      )}
    </div>
  );
}
