import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/server/access";
import { cancelRfqAction, acceptQuoteAction, declineRfqAction } from "@/server/actions";
import { expireStale, getBuyerRfq, getSupplierRfq } from "@/server/services/rfq";
import { Alert, Badge, Button, Card, PageHeader } from "@/components/ui";
import { DemoBadge, VerifiedBadge } from "@/components/market/parts";
import { QuoteForm } from "@/components/dashboard/quote-form";
import { RfqAttachments } from "@/components/dashboard/rfq-attachments";
import { listAttachments } from "@/server/services/rfq-attachments";
import { formatDate, formatMoney, formatQty } from "@/lib/utils";
import { BUYER_TYPES } from "@bmn/config";
import { bestValueId, coverageOf, valueScores, type CompareQuote } from "@/lib/compare";
import { chainRoleLabel } from "@/lib/supply-chain";

export const metadata: Metadata = { title: "RFQ" };

const REC_TONE = {
  SENT: "blue",
  VIEWED: "amber",
  RESPONDED: "green",
  DECLINED: "neutral",
  EXPIRED: "neutral",
} as const;
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default async function RfqDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const ctx = await requireCtx();
  const { id } = await params;
  const sp = await searchParams;
  await expireStale();

  // ───── supplier view ─────
  if (ctx.orgType === "SUPPLIER") {
    const data = await getSupplierRfq(ctx, id);
    if (!data) notFound();
    const { rfq, recipient, quote } = data;
    const open = rfq.status === "OPEN" && rfq.expiresAt > new Date();
    return (
      <div className="max-w-3xl">
        <PageHeader
          title={`RFQ ${rfq.number}`}
          description={`From ${rfq.buyerOrg.name}${rfq.buyerOrg.city ? ` · ${rfq.buyerOrg.city}` : ""}`}
          action={<Badge tone={REC_TONE[recipient.status]}>{label(recipient.status)}</Badge>}
        />
        <Card className="mb-4 space-y-3 text-sm">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-muted">Deliver to</dt>
              <dd className="font-medium">
                {rfq.deliveryCity}
                {rfq.deliveryAddress ? `, ${rfq.deliveryAddress}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Required by</dt>
              <dd className="font-medium">{formatDate(rfq.requiredDate)}</dd>
            </div>
            <div>
              <dt className="text-muted">Quote before</dt>
              <dd className="font-medium">{formatDate(rfq.expiresAt)}</dd>
            </div>
          </dl>
          {rfq.notes ? <p className="text-slate-700">{rfq.notes}</p> : null}
          <ul className="divide-y divide-line rounded-lg border border-line">
            {rfq.items.map((i) => (
              <li key={i.id} className="px-3 py-2">
                <span className="font-medium">{i.name}</span> — {formatQty(i.quantity)}{" "}
                {i.unit.name.toLowerCase()}
                {i.specification ? <span className="text-muted"> · {i.specification}</span> : null}
              </li>
            ))}
          </ul>
        </Card>
        <div className="mb-4">
          <RfqAttachments
            rfqId={rfq.id}
            files={(await listAttachments(ctx, rfq.id)).map((f) => ({
              id: f.id,
              filename: f.filename,
              sizeBytes: f.sizeBytes,
            }))}
            canEdit={false}
          />
        </div>
        {quote?.order ? (
          <Alert tone="success">
            Your quote was accepted.{" "}
            <Link className="underline" href={`/dashboard/orders/${quote.order.id}`}>
              Open the order
            </Link>
            .
          </Alert>
        ) : null}
        {quote && quote.status === "REJECTED" ? (
          <Alert>The buyer chose another supplier for this request.</Alert>
        ) : null}
        {!open && !quote ? <Alert>This request is no longer accepting quotes.</Alert> : null}
        {open && recipient.status !== "DECLINED" && (!quote || quote.status === "SUBMITTED") ? (
          <>
            <QuoteForm
              rfqId={rfq.id}
              items={rfq.items.map((i) => ({
                id: i.id,
                name: i.name,
                quantity: i.quantity.toString(),
                unit: i.unit.name.toLowerCase(),
                specification: i.specification,
              }))}
              existing={
                quote
                  ? {
                      deliveryDays: quote.deliveryDays,
                      deliveryCost: quote.deliveryCost.toString(),
                      notes: quote.notes,
                      items: Object.fromEntries(
                        quote.items.map((qi) => [
                          qi.rfqItemId,
                          {
                            unitPrice: qi.unitPrice.toString(),
                            quantityAvailable: qi.quantityAvailable.toString(),
                            minOrderQty: qi.minOrderQty.toString(),
                          },
                        ]),
                      ),
                    }
                  : null
              }
            />
            {!quote ? (
              <form action={declineRfqAction} className="mt-3">
                <input type="hidden" name="rfqId" value={rfq.id} />
                <Button type="submit" variant="ghost">
                  Decline this request
                </Button>
              </form>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  // ───── buyer view ─────
  if (!BUYER_TYPES.includes(ctx.orgType)) notFound();
  const rfq = await getBuyerRfq(ctx, id);
  if (!rfq) notFound();
  const open = rfq.status === "OPEN";
  const quotes = rfq.quotes;
  const cheapest = quotes
    .filter((q) => q.status === "SUBMITTED" || q.status === "ACCEPTED")
    .sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount))[0]?.id;
  const fastest = quotes
    .filter((q) => q.deliveryDays != null && (q.status === "SUBMITTED" || q.status === "ACCEPTED"))
    .sort((a, b) => (a.deliveryDays ?? 99) - (b.deliveryDays ?? 99))[0]?.id;

  const city = rfq.deliveryCity.trim().toLowerCase();
  const compareInput: CompareQuote[] = quotes
    .filter((q) => q.status === "SUBMITTED" || q.status === "ACCEPTED")
    .map((q) => ({
      id: q.id,
      total: Number(q.totalAmount),
      deliveryDays: q.deliveryDays,
      coverage: coverageOf(
        rfq.items.map((it) => ({
          requested: Number(it.quantity),
          available: (() => {
            const qi = q.items.find((x) => x.rfqItemId === it.id);
            return qi ? Number(qi.quantityAvailable) : null;
          })(),
        })),
      ),
      verified: q.supplierOrg.verificationStatus === "VERIFIED",
      sameCity: (q.supplierOrg.city ?? "").trim().toLowerCase() === city,
    }));
  const bestValue = bestValueId(compareInput);
  const scores = valueScores(compareInput);
  const partialItems = rfq.items.filter((it) =>
    quotes.some((q) => {
      const qi = q.items.find((x) => x.rfqItemId === it.id);
      return !qi || Number(qi.quantityAvailable) < Number(it.quantity);
    }),
  );

  return (
    <div>
      <PageHeader
        title={`RFQ ${rfq.number}`}
        description={rfq.title ?? undefined}
        action={
          <Badge
            tone={rfq.status === "OPEN" ? "blue" : rfq.status === "ACCEPTED" ? "green" : "neutral"}
          >
            {label(rfq.status)}
          </Badge>
        }
      />
      {sp.sent ? (
        <div className="mb-4">
          <Alert tone="success">
            Request sent to {rfq.recipients.length} supplier{rfq.recipients.length === 1 ? "" : "s"}
            . You will be notified as quotes arrive.
          </Alert>
        </div>
      ) : null}
      {sp.error ? (
        <div className="mb-4">
          <Alert tone="error">{sp.error}</Alert>
        </div>
      ) : null}

      <div className="mb-4">
        <RfqAttachments
          rfqId={rfq.id}
          files={(await listAttachments(ctx, rfq.id)).map((f) => ({
            id: f.id,
            filename: f.filename,
            sizeBytes: f.sizeBytes,
          }))}
          canEdit={open}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="text-sm">
          <h2 className="font-semibold">Request details</h2>
          <dl className="mt-2 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-muted">Deliver to</dt>
              <dd className="font-medium">{rfq.deliveryCity}</dd>
            </div>
            <div>
              <dt className="text-muted">Required by</dt>
              <dd className="font-medium">{formatDate(rfq.requiredDate)}</dd>
            </div>
            <div>
              <dt className="text-muted">{open ? "Closes" : "Closed"}</dt>
              <dd className="font-medium">{formatDate(rfq.expiresAt)}</dd>
            </div>
          </dl>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {rfq.items.map((i) => (
              <li key={i.id} className="px-3 py-2">
                <span className="font-medium">{i.name}</span> — {formatQty(i.quantity)}{" "}
                {i.unit.name.toLowerCase()}
                {i.specification ? <span className="text-muted"> · {i.specification}</span> : null}
              </li>
            ))}
          </ul>
          {rfq.notes ? <p className="mt-3 text-slate-700">{rfq.notes}</p> : null}
          {open ? (
            <form action={cancelRfqAction} className="mt-3">
              <input type="hidden" name="rfqId" value={rfq.id} />
              <Button type="submit" variant="ghost" size="sm">
                Cancel request
              </Button>
            </form>
          ) : null}
        </Card>
        <Card className="text-sm">
          <h2 className="font-semibold">Supplier responses</h2>
          <ul className="mt-2 space-y-2">
            {rfq.recipients.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{r.supplierOrg.name}</span>
                <Badge tone={REC_TONE[r.status]}>{label(r.status)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <h2 className="mb-1 mt-8 text-lg font-semibold">Compare quotes</h2>
      {quotes.length > 1 ? (
        <p className="mb-3 text-xs text-muted">
          Best value weighs total price (45%), delivery time (20%), how much of your quantity the
          supplier can supply (20%), verification (10%) and being in your delivery city (5%). It is
          a guide: you decide.
        </p>
      ) : (
        <div className="mb-3" />
      )}
      {quotes.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Supplier &amp; location</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3">Delivery</th>
                <th className="px-4 py-3">MOQ</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {quotes.map((q) => {
                const lines = rfq.items.map((it) => ({
                  it,
                  qi: q.items.find((x) => x.rfqItemId === it.id),
                }));
                const fullyAvailable = lines.every(
                  (l) => l.qi && Number(l.qi.quantityAvailable) >= Number(l.it.quantity),
                );
                const canAccept = open && q.status === "SUBMITTED" && q.validUntil > new Date();
                return (
                  <tr key={q.id} className={q.status === "ACCEPTED" ? "bg-emerald-50/50" : ""}>
                    <td className="px-4 py-3">
                      <Link
                        className="font-medium hover:text-brand-700"
                        href={`/suppliers/${q.supplierOrg.slug}`}
                      >
                        {q.supplierOrg.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {chainRoleLabel(q.supplierOrg)}
                        {q.supplierOrg.city ? ` · ${q.supplierOrg.city}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {q.id === bestValue ? <Badge tone="green">Best value</Badge> : null}
                        {(q.supplierOrg.city ?? "").trim().toLowerCase() === city ? (
                          <Badge tone="blue">In {rfq.deliveryCity}</Badge>
                        ) : null}
                        <DemoBadge show={q.supplierOrg.isDemo} />
                      </div>
                      {scores.has(q.id) && quotes.length > 1 ? (
                        <p className="mt-1 text-xs text-muted">Score {scores.get(q.id)}/100</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-base font-bold">
                        {formatMoney(q.totalAmount.toString(), q.currency)}
                      </p>
                      {q.id === cheapest && quotes.length > 1 ? (
                        <Badge tone="green">Lowest total</Badge>
                      ) : null}
                      <ul className="mt-1 text-xs text-muted">
                        {lines.map(({ it, qi }) => (
                          <li key={it.id}>
                            {qi
                              ? `${formatMoney(qi.unitPrice.toString(), q.currency)} / ${it.unit.name.toLowerCase()}`
                              : "—"}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3">
                      {fullyAvailable ? (
                        <Badge tone="green">Full quantity</Badge>
                      ) : (
                        <Badge tone="amber">Partial</Badge>
                      )}
                      <ul className="mt-1 text-xs text-muted">
                        {lines.map(({ it, qi }) => (
                          <li key={it.id}>
                            {qi
                              ? `${formatQty(qi.quantityAvailable)} of ${formatQty(it.quantity)}`
                              : "—"}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3">
                      {q.deliveryDays != null
                        ? `${q.deliveryDays} day${q.deliveryDays === 1 ? "" : "s"}`
                        : "—"}{" "}
                      {q.id === fastest && quotes.length > 1 ? (
                        <Badge tone="blue">Fastest</Badge>
                      ) : null}
                      <p className="text-xs text-muted">
                        {Number(q.deliveryCost)
                          ? `+ ${formatMoney(q.deliveryCost.toString(), q.currency)}`
                          : "Free delivery"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {lines.map(({ it, qi }) => (
                        <p key={it.id} className="text-xs">
                          {qi ? formatQty(qi.minOrderQty) : "—"}
                        </p>
                      ))}
                    </td>
                    <td className="px-4 py-3">
                      {q.supplierOrg.verificationStatus === "VERIFIED" ? (
                        <VerifiedBadge status="VERIFIED" />
                      ) : (
                        <span className="text-xs text-muted">Not verified</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {q.status === "ACCEPTED" ? (
                        <Link
                          className="text-sm font-medium text-brand-700 hover:underline"
                          href={q.order ? `/dashboard/orders/${q.order.id}` : "#"}
                        >
                          Order {q.order?.number}
                        </Link>
                      ) : canAccept ? (
                        <form action={acceptQuoteAction}>
                          <input type="hidden" name="quoteId" value={q.id} />
                          <input type="hidden" name="rfqId" value={rfq.id} />
                          <Button type="submit" size="sm">
                            Accept quote
                          </Button>
                          <p className="mt-1 text-xs text-muted">
                            Valid until {formatDate(q.validUntil)}
                          </p>
                        </form>
                      ) : (
                        <Badge>{label(q.status)}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Alert>
          No quotes yet. Suppliers usually respond within a day — we will notify you as they arrive.
        </Alert>
      )}
      {partialItems.length ? (
        <Card className="mt-4 text-sm">
          <p className="font-semibold">Short on an item? See alternatives</p>
          <p className="mt-1 text-muted">
            Some suppliers cannot cover the full quantity of these items. Smart matching finds
            comparable products from other suppliers.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {partialItems.slice(0, 8).map((it) => (
              <li key={it.id}>
                <Link
                  className="inline-block rounded-full border border-line px-3 py-1 text-brand-700 hover:bg-brand-50"
                  href={`/match?q=${encodeURIComponent(it.name)}&city=${encodeURIComponent(rfq.deliveryCity)}&qty=${Number(it.quantity)}`}
                >
                  {it.name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
