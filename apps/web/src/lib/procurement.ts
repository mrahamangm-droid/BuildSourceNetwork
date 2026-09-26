/**
 * Project procurement pipeline: BOQ -> RFQ -> Quotes -> Orders -> Delivery. Pure summary of what a
 * project has so far, including the split across suppliers when one project buys from several.
 */
export type PipelineInput = {
  boqLines: number;
  rfqs: { status: string; quoteCount: number }[];
  orders: {
    status: string;
    supplierOrgId: string;
    supplierName: string;
    total: number;
    delivered: boolean;
  }[];
};
export type Stage = {
  key: "boq" | "rfq" | "quotes" | "orders" | "delivery";
  label: string;
  count: number;
  detail: string;
  state: "done" | "active" | "todo";
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function pipeline(p: PipelineInput): Stage[] {
  const activeOrders = p.orders.filter((o) => o.status !== "CANCELLED");
  const delivered = activeOrders.filter((o) => o.delivered).length;
  const quotes = p.rfqs.reduce((n, r) => n + r.quoteCount, 0);
  const raw: Omit<Stage, "state">[] = [
    { key: "boq", label: "BOQ", count: p.boqLines, detail: plural(p.boqLines, "line") },
    { key: "rfq", label: "RFQs", count: p.rfqs.length, detail: plural(p.rfqs.length, "request") },
    { key: "quotes", label: "Quotes", count: quotes, detail: plural(quotes, "quote") },
    {
      key: "orders",
      label: "Orders",
      count: activeOrders.length,
      detail: plural(activeOrders.length, "order"),
    },
    {
      key: "delivery",
      label: "Delivery",
      count: delivered,
      detail: `${delivered} of ${activeOrders.length} delivered`,
    },
  ];
  // The first stage with nothing complete yet is "active"; everything before it is done.
  const complete = [
    p.boqLines > 0,
    p.rfqs.length > 0,
    quotes > 0,
    activeOrders.length > 0,
    activeOrders.length > 0 && delivered === activeOrders.length,
  ];
  const firstOpen = complete.indexOf(false);
  return raw.map((s, i) => ({
    ...s,
    state: firstOpen === -1 || i < firstOpen ? "done" : i === firstOpen ? "active" : "todo",
  }));
}

export type SupplierSplit = {
  supplierOrgId: string;
  supplierName: string;
  orders: number;
  total: number;
};

/** Committed spend per supplier (cancelled orders excluded), largest first. */
export function supplierSplit(orders: PipelineInput["orders"]): SupplierSplit[] {
  const m = new Map<string, SupplierSplit>();
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    const cur = m.get(o.supplierOrgId) ?? {
      supplierOrgId: o.supplierOrgId,
      supplierName: o.supplierName,
      orders: 0,
      total: 0,
    };
    cur.orders++;
    cur.total += o.total;
    m.set(o.supplierOrgId, cur);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

export const isDeliveredStatus = (s: string) => s === "DELIVERED" || s === "COMPLETED";
