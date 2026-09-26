import { describe, expect, it } from "vitest";
import { rankMatches, tokenize, servesCity, type MatchCandidate } from "@/lib/match";
import { rankAlternatives, specOverlap, type AltCandidate } from "@/lib/alternatives";
import { bestValueId, coverageOf, valueScores } from "@/lib/compare";
import { regularMaterials, toRfqItems } from "@/lib/reorder";
import { pipeline, supplierSplit } from "@/lib/procurement";
import { chainRoleLabel, chainStepFor } from "@/lib/supply-chain";

const cand = (o: Partial<MatchCandidate> = {}): MatchCandidate => ({
  id: "p1",
  name: "Portland Cement 42.5N 50kg",
  sku: null,
  description: null,
  brandName: "Acme",
  categoryName: "Cement",
  price: 20,
  minOrderQty: 10,
  stockStatus: "IN_STOCK",
  city: "Dubai",
  deliveryAvailable: true,
  orgId: "o1",
  orgName: "Org 1",
  orgCity: "Dubai",
  orgVerified: false,
  deliveryAreas: [],
  ...o,
});

describe("smart material matching", () => {
  it("tokenizes words and numbers, dropping filler", () => {
    expect(tokenize("Need cement 42.5N for the slab")).toEqual(["cement", "42.5n", "slab"]);
    expect(tokenize("")).toEqual([]);
  });
  it("ranks a full keyword match in stock above a partial out-of-stock one", () => {
    const good = cand({ id: "a", orgId: "oa" });
    const bad = cand({ id: "b", orgId: "ob", name: "Sand", stockStatus: "OUT_OF_STOCK" });
    const r = rankMatches([bad, good], { q: "cement 42.5n", city: "Dubai" });
    expect(r[0]!.item.id).toBe("a");
    expect(r[0]!.reasons).toContain("In stock");
    expect(r[0]!.reasons).toContain("Serves Dubai");
  });
  it("keeps only the best product per supplier", () => {
    const r = rankMatches(
      [cand({ id: "a" }), cand({ id: "b", name: "Cement bag" }), cand({ id: "c", orgId: "o2" })],
      { q: "cement" },
    );
    expect(r.map((x) => x.item.orgId).sort()).toEqual(["o1", "o2"]);
  });
  it("rewards verified suppliers and city coverage via delivery areas", () => {
    const v = cand({
      id: "v",
      orgId: "ov",
      orgVerified: true,
      city: null,
      orgCity: null,
      deliveryAreas: ["Sharjah"],
    });
    expect(servesCity(v, "sharjah")).toBe(true);
    const r = rankMatches([v, cand({ id: "u", orgId: "ou" })], { q: "cement", city: "Sharjah" });
    expect(r[0]!.item.id).toBe("v");
  });
  it("flags a minimum order above the requested quantity", () => {
    const r = rankMatches([cand({ minOrderQty: 100 })], { q: "cement", qty: 10 });
    expect(r[0]!.reasons.some((x) => x.startsWith("Minimum order"))).toBe(true);
  });
});

describe("smart alternatives", () => {
  const base = {
    id: "x",
    orgId: "o1",
    brandId: "b1",
    price: 100,
    city: "Dubai",
    specifications: { Grade: "60" },
  };
  const alt = (o: Partial<AltCandidate>): AltCandidate => ({
    ...base,
    id: "y",
    orgId: "o2",
    name: "Alt",
    stockStatus: "IN_STOCK",
    deliveryAvailable: true,
    orgVerified: false,
    orgCity: "Dubai",
    deliveryAreas: [],
    ...o,
  });
  it("never suggests the original or out-of-stock items", () => {
    const r = rankAlternatives(base, [
      alt({ id: "x" }),
      alt({ id: "z", stockStatus: "OUT_OF_STOCK" }),
      alt({ id: "ok" }),
    ]);
    expect(r.map((a) => a.item.id)).toEqual(["ok"]);
  });
  it("prefers same brand from another supplier and cheaper items, with reasons", () => {
    const r = rankAlternatives(base, [
      alt({ id: "same", brandId: "b1" }),
      alt({ id: "diff", brandId: "b2", price: 140 }),
      alt({ id: "cheap", brandId: "b2", price: 80 }),
    ]);
    expect(r[0]!.item.id).toBe("same");
    expect(r[0]!.reasons).toContain("Same brand, different supplier");
    expect(r.find((a) => a.item.id === "cheap")!.reasons).toContain("20% cheaper");
    expect(r.at(-1)!.item.id).toBe("diff");
  });
  it("counts matching specifications case-insensitively", () => {
    expect(specOverlap({ Grade: "60", Size: "12mm" }, { grade: "60", size: "10mm" })).toBe(1);
  });
});

describe("supplier comparison", () => {
  const q = (id: string, o = {}) => ({
    id,
    total: 1000,
    deliveryDays: 3,
    coverage: 1,
    verified: false,
    sameCity: false,
    ...o,
  });
  it("needs at least two quotes for a best-value pick", () => {
    expect(bestValueId([q("a")])).toBeNull();
  });
  it("prefers a slightly dearer but complete, verified, faster quote over a cheap partial one", () => {
    const cheapPartial = q("cheap", { total: 900, coverage: 0.4, deliveryDays: 10 });
    const solid = q("solid", { total: 1000, coverage: 1, verified: true, deliveryDays: 2 });
    expect(bestValueId([cheapPartial, solid])).toBe("solid");
  });
  it("scores stay within 0..100", () => {
    for (const s of valueScores([q("a"), q("b", { total: 2000, deliveryDays: null })]).values()) {
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
  it("computes quantity coverage", () => {
    expect(
      coverageOf([
        { requested: 10, available: 5 },
        { requested: 10, available: 20 },
      ]),
    ).toBe(0.75);
    expect(coverageOf([])).toBe(0);
  });
});

describe("regular materials and reorder", () => {
  const line = (o = {}) => ({
    orderId: "o1",
    orderedAt: new Date("2026-01-01"),
    supplierOrgId: "s1",
    supplierName: "S1",
    name: "Cement",
    productId: "p1",
    quantity: 10,
    unitCode: "BAG",
    unitPrice: 20,
    ...o,
  });
  it("groups by product, counts distinct orders, uses the latest order for defaults", () => {
    const r = regularMaterials([
      line(),
      line({
        orderId: "o2",
        orderedAt: new Date("2026-03-01"),
        quantity: 30,
        unitPrice: 22,
        supplierOrgId: "s2",
        supplierName: "S2",
      }),
      line({ orderId: "o3", productId: null, name: "Sand", unitCode: "TON" }),
    ]);
    expect(r[0]).toMatchObject({
      productId: "p1",
      orders: 2,
      lastQuantity: 30,
      lastPrice: 22,
      supplierName: "S2",
    });
    expect(r).toHaveLength(2);
  });
  it("maps order lines to RFQ items", () => {
    const items = toRfqItems(
      [{ name: "Cement", productId: "p1", quantity: 12.5, unitCode: "BAG" }],
      new Map([["p1", "c9"]]),
    );
    expect(items[0]).toMatchObject({
      categoryId: "c9",
      productId: "p1",
      quantity: "12.5",
      unitCode: "BAG",
    });
  });
});

describe("procurement pipeline", () => {
  it("marks the first unfinished stage active", () => {
    const s = pipeline({ boqLines: 5, rfqs: [{ status: "OPEN", quoteCount: 0 }], orders: [] });
    expect(s.map((x) => x.state)).toEqual(["done", "done", "active", "todo", "todo"]);
  });
  it("is all done when every order is delivered", () => {
    const s = pipeline({
      boqLines: 1,
      rfqs: [{ status: "ACCEPTED", quoteCount: 2 }],
      orders: [
        { status: "COMPLETED", supplierOrgId: "a", supplierName: "A", total: 10, delivered: true },
      ],
    });
    expect(s.every((x) => x.state === "done")).toBe(true);
  });
  it("splits spend per supplier and ignores cancelled orders", () => {
    const o = (id: string, total: number, status = "CONFIRMED") => ({
      status,
      supplierOrgId: id,
      supplierName: id,
      total,
      delivered: false,
    });
    expect(supplierSplit([o("a", 100), o("b", 300), o("a", 50), o("c", 999, "CANCELLED")])).toEqual(
      [
        { supplierOrgId: "b", supplierName: "b", orders: 1, total: 300 },
        { supplierOrgId: "a", supplierName: "a", orders: 2, total: 150 },
      ],
    );
  });
});

describe("supply chain position", () => {
  it("maps org type and supplier kind onto the chain", () => {
    expect(chainStepFor({ type: "SUPPLIER", supplierKind: "MANUFACTURER" })).toBe("MANUFACTURER");
    expect(chainStepFor({ type: "SUPPLIER", supplierKind: "DISTRIBUTOR" })).toBe("SUPPLIER");
    expect(chainStepFor({ type: "STORE" })).toBe("STORE");
    expect(chainStepFor({ type: "CONTRACTOR" })).toBe("BUYER");
    expect(chainRoleLabel({ type: "SUPPLIER", supplierKind: "WHOLESALER" })).toBe("Wholesaler");
  });
});
