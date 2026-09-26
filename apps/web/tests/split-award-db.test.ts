import { beforeAll, describe, expect, it } from "vitest";
import { makeAccount, resetDb } from "./helpers";

type Acc = Awaited<ReturnType<typeof makeAccount>>;
let rfqSvc: typeof import("@/server/services/rfq");
let db: typeof import("@bmn/database").db;
let n = 0;

/** An open RFQ with two items and one quote per supplier (price per item). */
async function setup(
  buyer: Acc,
  sups: { acc: Acc; cem: number; rebar: number; delivery: number }[],
) {
  n += 1;
  const rfq = await db.rfq.create({
    data: {
      number: `RFQ-SPLIT-${n}`,
      buyerOrgId: buyer.ctx.orgId,
      createdById: buyer.userId,
      deliveryCity: "Dubai",
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      items: {
        create: [
          { name: "Cement", quantity: 100, unitCode: "BAG" },
          { name: "Rebar", quantity: 10, unitCode: "TON" },
        ],
      },
    },
    include: { items: true },
  });
  const cem = rfq.items.find((i) => i.name === "Cement")!;
  const rebar = rfq.items.find((i) => i.name === "Rebar")!;
  const quoteIds: string[] = [];
  for (const s of sups) {
    const q = await db.quote.create({
      data: {
        rfqId: rfq.id,
        supplierOrgId: s.acc.ctx.orgId,
        deliveryCost: s.delivery,
        validUntil: new Date(Date.now() + 5 * 86_400_000),
        totalAmount: 1,
        items: {
          create: [
            { rfqItemId: cem.id, unitPrice: s.cem, quantityAvailable: 100 },
            { rfqItemId: rebar.id, unitPrice: s.rebar, quantityAvailable: 10 },
          ],
        },
      },
    });
    quoteIds.push(q.id);
  }
  return { rfq, cem, rebar, quoteIds };
}

beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
  rfqSvc = await import("@/server/services/rfq");
});

describe("split award", () => {
  it("creates one order per supplier, closes the RFQ and rejects unused quotes", async () => {
    const buyer = await makeAccount("CONTRACTOR", { name: "Split Buyer" });
    const a = await makeAccount("SUPPLIER", { name: "Split Sup A" });
    const b = await makeAccount("SUPPLIER", { name: "Split Sup B" });
    const c = await makeAccount("SUPPLIER", { name: "Split Sup C" });
    const { rfq, cem, rebar, quoteIds } = await setup(buyer, [
      { acc: a, cem: 10, rebar: 300, delivery: 50 },
      { acc: b, cem: 11, rebar: 250, delivery: 0 },
      { acc: c, cem: 12, rebar: 260, delivery: 20 },
    ]);
    const orders = await rfqSvc.awardSplit(buyer.ctx, rfq.id, {
      assignments: [
        { rfqItemId: cem.id, quoteId: quoteIds[0]! },
        { rfqItemId: rebar.id, quoteId: quoteIds[1]! },
      ],
    });
    expect(orders).toHaveLength(2);
    const byOrg = new Map(orders.map((o) => [o.supplierOrgId, o]));
    expect(Number(byOrg.get(a.ctx.orgId)!.totalAmount)).toBe(1050);
    expect(Number(byOrg.get(b.ctx.orgId)!.totalAmount)).toBe(2500);

    const quotes = await db.quote.findMany({ where: { rfqId: rfq.id } });
    const st = (id: string) => quotes.find((q) => q.id === id)!.status;
    expect([st(quoteIds[0]!), st(quoteIds[1]!), st(quoteIds[2]!)]).toEqual([
      "ACCEPTED",
      "ACCEPTED",
      "REJECTED",
    ]);
    expect((await db.rfq.findUniqueOrThrow({ where: { id: rfq.id } })).status).toBe("ACCEPTED");
    const items = await db.orderItem.findMany({ where: { orderId: byOrg.get(a.ctx.orgId)!.id } });
    expect(items.map((i) => [i.name, Number(i.quantity), i.unitCode])).toEqual([
      ["Cement", 100, "BAG"],
    ]);
    expect(
      await db.notification.count({ where: { orgId: { in: [a.ctx.orgId, b.ctx.orgId] } } }),
    ).toBeGreaterThanOrEqual(2);
  });

  it("cannot be done twice, and a normal accept is then refused too", async () => {
    const buyer = await makeAccount("CONTRACTOR", { name: "Split Buyer 2" });
    const a = await makeAccount("SUPPLIER", { name: "Split Sup D" });
    const { rfq, cem, quoteIds } = await setup(buyer, [
      { acc: a, cem: 10, rebar: 300, delivery: 0 },
    ]);
    const pick = { assignments: [{ rfqItemId: cem.id, quoteId: quoteIds[0]! }] };
    await rfqSvc.awardSplit(buyer.ctx, rfq.id, pick);
    await expect(rfqSvc.awardSplit(buyer.ctx, rfq.id, pick)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(rfqSvc.acceptQuote(buyer.ctx, quoteIds[0]!)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await db.order.count({ where: { rfqId: rfq.id } })).toBe(1);
  });

  it("validates the selection and creates nothing when it is bad", async () => {
    const buyer = await makeAccount("CONTRACTOR", { name: "Split Buyer 3" });
    const other = await makeAccount("CONTRACTOR", { name: "Split Other Buyer" });
    const a = await makeAccount("SUPPLIER", { name: "Split Sup E" });
    const b = await makeAccount("SUPPLIER", { name: "Split Sup F" });
    const { rfq, cem, rebar, quoteIds } = await setup(buyer, [
      { acc: a, cem: 10, rebar: 300, delivery: 0 },
      { acc: b, cem: 11, rebar: 250, delivery: 0 },
    ]);
    const orderCount = () => db.order.count({ where: { rfqId: rfq.id } });

    await expect(rfqSvc.awardSplit(buyer.ctx, rfq.id, { assignments: [] })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(
      rfqSvc.awardSplit(buyer.ctx, rfq.id, {
        assignments: [
          { rfqItemId: cem.id, quoteId: quoteIds[0]! },
          { rfqItemId: cem.id, quoteId: quoteIds[1]! },
        ],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      rfqSvc.awardSplit(buyer.ctx, rfq.id, {
        assignments: [{ rfqItemId: "nope", quoteId: quoteIds[0]! }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // another buyer cannot award this RFQ
    await expect(
      rfqSvc.awardSplit(other.ctx, rfq.id, {
        assignments: [{ rfqItemId: cem.id, quoteId: quoteIds[0]! }],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // a supplier cannot either
    await expect(
      rfqSvc.awardSplit(a.ctx, rfq.id, {
        assignments: [{ rfqItemId: rebar.id, quoteId: quoteIds[0]! }],
      }),
    ).rejects.toBeTruthy();
    // an expired quote is refused
    await db.quote.update({
      where: { id: quoteIds[1]! },
      data: { validUntil: new Date(Date.now() - 1000) },
    });
    await expect(
      rfqSvc.awardSplit(buyer.ctx, rfq.id, {
        assignments: [{ rfqItemId: rebar.id, quoteId: quoteIds[1]! }],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(await orderCount()).toBe(0);
    expect((await db.rfq.findUniqueOrThrow({ where: { id: rfq.id } })).status).toBe("OPEN");
  });
});
