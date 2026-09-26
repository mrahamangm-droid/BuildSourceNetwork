import { describe, expect, it } from "vitest";
import {
  orderedQty,
  suggestAssignment,
  summarizeAward,
  type AwardItem,
  type AwardOffer,
  type AwardQuote,
} from "@/lib/split-award";

const items: AwardItem[] = [
  { id: "cem", name: "Cement", quantity: 100 },
  { id: "rebar", name: "Rebar", quantity: 10 },
];
const quotes: AwardQuote[] = [
  { id: "qA", deliveryCost: 50 },
  { id: "qB", deliveryCost: 0 },
];
const offers: AwardOffer[] = [
  { quoteId: "qA", rfqItemId: "cem", unitPrice: 10, quantityAvailable: 100 },
  { quoteId: "qA", rfqItemId: "rebar", unitPrice: 300, quantityAvailable: 10 },
  { quoteId: "qB", rfqItemId: "cem", unitPrice: 11, quantityAvailable: 100 },
  { quoteId: "qB", rfqItemId: "rebar", unitPrice: 250, quantityAvailable: 10 },
];

describe("split award maths", () => {
  it("caps the ordered quantity at what was requested and treats no offer as zero", () => {
    expect(orderedQty(items[0]!, offers[0])).toBe(100);
    expect(orderedQty(items[1]!, { ...offers[1]!, quantityAvailable: 4 })).toBe(4);
    expect(orderedQty(items[1]!, { ...offers[1]!, quantityAvailable: 999 })).toBe(10);
    expect(orderedQty(items[0]!, undefined)).toBe(0);
  });

  it("suggests the cheapest supplier per line, which can differ between lines", () => {
    expect(suggestAssignment(items, quotes, offers)).toEqual({ cem: "qA", rebar: "qB" });
  });

  it("prefers a supplier that covers the full quantity over a cheaper partial one", () => {
    const o = offers.map((x) =>
      x.quoteId === "qA" && x.rfqItemId === "cem" ? { ...x, quantityAvailable: 40 } : x,
    );
    expect(suggestAssignment(items, quotes, o).cem).toBe("qB");
  });

  it("leaves an item unassigned when nobody offers it", () => {
    const only = offers.filter((o) => o.rfqItemId === "cem");
    expect(suggestAssignment(items, quotes, only).rebar).toBeNull();
  });

  it("builds one order per supplier with delivery charged once each", () => {
    const s = summarizeAward(items, quotes, offers, { cem: "qA", rebar: "qB" });
    expect(s.orders).toHaveLength(2);
    const a = s.orders.find((o) => o.quoteId === "qA")!;
    const b = s.orders.find((o) => o.quoteId === "qB")!;
    expect([a.subtotal, a.deliveryCost, a.total]).toEqual([1000, 50, 1050]);
    expect([b.subtotal, b.deliveryCost, b.total]).toEqual([2500, 0, 2500]);
    expect(s.grandTotal).toBe(3550);
    expect(s.unassigned).toEqual([]);
  });

  it("charges delivery once when one supplier gets several lines", () => {
    const s = summarizeAward(items, quotes, offers, { cem: "qA", rebar: "qA" });
    expect(s.orders).toHaveLength(1);
    expect(s.orders[0]!.total).toBe(4050);
  });

  it("reports skipped and short items, and ignores a supplier that has no offer for the line", () => {
    const o = offers.map((x) =>
      x.quoteId === "qB" && x.rfqItemId === "rebar" ? { ...x, quantityAvailable: 6 } : x,
    );
    const s = summarizeAward(items, quotes, o, { cem: null, rebar: "qB" });
    expect(s.unassigned).toEqual(["cem"]);
    expect(s.short).toEqual(["rebar"]);
    expect(s.orders[0]!.lines[0]).toMatchObject({ quantity: 6, requested: 10, lineTotal: 1500 });
    const none = summarizeAward(items, quotes, offers.slice(0, 1), { cem: "qB", rebar: "qA" });
    expect(none.orders).toHaveLength(0);
    expect(none.grandTotal).toBe(0);
  });
});
