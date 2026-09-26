"use client";
import { useMemo, useState } from "react";
import { Card, Select } from "@/components/ui";
import { SubmitButton } from "@/components/forms/shared";
import { awardSplitAction } from "@/server/actions";
import {
  suggestAssignment,
  summarizeAward,
  type Assignment,
  type AwardItem,
  type AwardOffer,
  type AwardQuote,
} from "@/lib/split-award";
import { formatMoney, formatQty } from "@/lib/utils";

type Props = {
  rfqId: string;
  currency: string;
  items: (AwardItem & { unit: string })[];
  quotes: (AwardQuote & { supplier: string })[];
  offers: AwardOffer[];
};

export function SplitAward({ rfqId, currency, items, quotes, offers }: Props) {
  const plain = useMemo(
    () => items.map(({ id, name, quantity }) => ({ id, name, quantity })),
    [items],
  );
  const [assignment, setAssignment] = useState<Assignment>(() =>
    suggestAssignment(plain, quotes, offers),
  );
  const summary = summarizeAward(plain, quotes, offers, assignment);
  const picks = summary.orders.flatMap((o) =>
    o.lines.map((l) => ({ rfqItemId: l.rfqItemId, quoteId: o.quoteId })),
  );
  const name = (quoteId: string) => quotes.find((q) => q.id === quoteId)?.supplier ?? "";

  return (
    <Card className="mt-4 text-sm">
      <h3 className="font-semibold">Split the award between suppliers</h3>
      <p className="mt-1 text-muted">
        Pick who supplies each item. We start from the cheapest supplier that can cover the full
        quantity. Each supplier you choose gets its own order, and delivery is charged once per
        order. Quotes you do not use are declined.
      </p>
      <form action={awardSplitAction} className="mt-3 space-y-3">
        <input type="hidden" name="rfqId" value={rfqId} />
        <input type="hidden" name="assignments" value={JSON.stringify(picks)} />
        <ul className="divide-y divide-line rounded-lg border border-line">
          {items.map((it) => {
            const opts = offers.filter(
              (o) => o.rfqItemId === it.id && quotes.some((q) => q.id === o.quoteId),
            );
            return (
              <li key={it.id} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_minmax(0,320px)]">
                <div>
                  <p className="font-medium">{it.name}</p>
                  <p className="text-xs text-muted">
                    {formatQty(it.quantity)} {it.unit.toLowerCase()} requested
                  </p>
                </div>
                <Select
                  aria-label={`Supplier for ${it.name}`}
                  value={assignment[it.id] ?? ""}
                  onChange={(e) =>
                    setAssignment((a) => ({ ...a, [it.id]: e.target.value || null }))
                  }
                >
                  <option value="">Do not order this item</option>
                  {opts.map((o) => (
                    <option key={o.quoteId} value={o.quoteId} disabled={o.quantityAvailable <= 0}>
                      {name(o.quoteId)} — {formatMoney(String(o.unitPrice), currency)} ·{" "}
                      {formatQty(Math.min(o.quantityAvailable, it.quantity))} available
                    </option>
                  ))}
                </Select>
              </li>
            );
          })}
        </ul>
        {summary.short.length ? (
          <p className="text-amber-700">
            Short on: {summary.short.map((id) => items.find((i) => i.id === id)?.name).join(", ")}.
            You would receive less than requested.
          </p>
        ) : null}
        <div className="rounded-lg bg-surface p-3">
          {summary.orders.length ? (
            <ul className="space-y-1">
              {summary.orders.map((o) => (
                <li key={o.quoteId} className="flex justify-between gap-3">
                  <span>
                    {name(o.quoteId)} · {o.lines.length} item{o.lines.length === 1 ? "" : "s"}
                    {o.deliveryCost
                      ? ` + ${formatMoney(String(o.deliveryCost), currency)} delivery`
                      : ""}
                  </span>
                  <span className="font-medium">{formatMoney(String(o.total), currency)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3 border-t border-line pt-1 font-semibold">
                <span>
                  Total across {summary.orders.length} order{summary.orders.length === 1 ? "" : "s"}
                </span>
                <span>{formatMoney(String(summary.grandTotal), currency)}</span>
              </li>
            </ul>
          ) : (
            <p className="text-muted">Choose a supplier for at least one item.</p>
          )}
        </div>
        <SubmitButton disabled={!picks.length} pending="Placing orders…">
          Place {summary.orders.length || ""} order{summary.orders.length === 1 ? "" : "s"}
        </SubmitButton>
      </form>
    </Card>
  );
}
