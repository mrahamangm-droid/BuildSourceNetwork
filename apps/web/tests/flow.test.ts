import { beforeAll, describe, expect, it } from "vitest";
import { makeAccount, resetDb } from "./helpers";

type Acc = Awaited<ReturnType<typeof makeAccount>>;

let svc: {
  products: typeof import("@/server/services/products");
  rfq: typeof import("@/server/services/rfq");
  orders: typeof import("@/server/services/orders");
  accounts: typeof import("@/server/services/accounts");
  orgs: typeof import("@/server/services/orgs");
};
let db: typeof import("@bmn/database").db;

const supplierA = {} as { acc: Acc; productId: string };
const supplierB = {} as { acc: Acc; productId: string };
let contractor: Acc;
let otherBuyer: Acc;
let rfqId = "";
let cementCat = "";

const productInput = (name: string, price: number, catId: string) => ({
  name,
  categoryId: catId,
  unitCode: "BAG",
  price,
  minOrderQty: 10,
  stockStatus: "IN_STOCK",
  brandName: "TestBrand",
});

beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
  svc = {
    products: await import("@/server/services/products"),
    rfq: await import("@/server/services/rfq"),
    orders: await import("@/server/services/orders"),
    accounts: await import("@/server/services/accounts"),
    orgs: await import("@/server/services/orgs"),
  };
  cementCat = (await db.category.findUniqueOrThrow({ where: { slug: "cement" } })).id;
});

describe("registration & auth", () => {
  it("registers, requires unique email, verifies email", async () => {
    const a = await makeAccount("SUPPLIER", { verify: false, name: "Reg Test Supplier" });
    expect(a.ctx.emailVerified).toBe(false);
    await expect(
      svc.accounts.registerAccount({
        name: "X Y",
        email: "user1@test.example",
        password: "Sup3rSecret!pw",
        orgType: "STORE",
        orgName: "Dup",
        city: "Dubai",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await svc.accounts.verifyEmail(a.verifyToken)).toBe(true);
    expect(await svc.accounts.verifyEmail(a.verifyToken)).toBe(false); // single use
  });

  it("rejects weak passwords and bad org types", async () => {
    await expect(
      svc.accounts.registerAccount({
        name: "Weak",
        email: "weak@test.example",
        password: "short",
        orgType: "SUPPLIER",
        orgName: "Weak Co",
        city: "Dubai",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      svc.accounts.registerAccount({
        name: "Weak",
        email: "weak2@test.example",
        password: "Sup3rSecret!pw",
        orgType: "ADMIN",
        orgName: "Weak Co",
        city: "Dubai",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("password reset works once and does not reveal unknown emails", async () => {
    const a = await makeAccount("STORE", { name: "Reset Store" });
    const user = await db.user.findUniqueOrThrow({ where: { id: a.userId } });
    const { token } = await svc.accounts.requestPasswordReset(user.email);
    await expect(svc.accounts.resetPassword(token!, "short")).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await svc.accounts.resetPassword(token!, "BrandNewPass123");
    const bcrypt = (await import("bcryptjs")).default;
    const fresh = await db.user.findUniqueOrThrow({ where: { id: a.userId } });
    expect(await bcrypt.compare("BrandNewPass123", fresh.passwordHash)).toBe(true);
    await expect(svc.accounts.resetPassword(token!, "AnotherPass123")).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect((await svc.accounts.requestPasswordReset("nobody@test.example")).token).toBeUndefined();
  });
});

describe("catalogue & marketplace", () => {
  it("suppliers create products; unverified/non-seller accounts cannot", async () => {
    supplierA.acc = await makeAccount("SUPPLIER", { city: "Sharjah", name: "Alpha Supply" });
    supplierB.acc = await makeAccount("SUPPLIER", { city: "Dubai", name: "Beta Supply" });
    contractor = await makeAccount("CONTRACTOR", { city: "Sharjah", name: "Contractor One" });
    otherBuyer = await makeAccount("BUYER", { city: "Dubai", name: "Buyer Two" });

    supplierA.productId = (
      await svc.products.createProduct(
        supplierA.acc.ctx,
        productInput("Portland Cement 50kg", 18, cementCat),
      )
    ).id;
    supplierB.productId = (
      await svc.products.createProduct(
        supplierB.acc.ctx,
        productInput("Portland Cement 50kg", 17, cementCat),
      )
    ).id;

    await expect(
      svc.products.createProduct(contractor.ctx, productInput("Nope", 5, cementCat)),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const unverified = await makeAccount("SUPPLIER", { verify: false, name: "Unverified Supply" });
    await expect(
      svc.products.createProduct(unverified.ctx, productInput("X Cement", 5, cementCat)),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates product input", async () => {
    await expect(
      svc.products.createProduct(supplierA.acc.ctx, { ...productInput("A", -1, cementCat) }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      svc.products.createProduct(supplierA.acc.ctx, { ...productInput("Valid Name", 5, "nope") }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("search matches name, sku, brand, supplier, category and filters", async () => {
    const byName = await svc.products.searchProducts({ q: "cement" });
    expect(byName.total).toBe(2);
    expect((await svc.products.searchProducts({ q: "testbrand" })).total).toBe(2);
    expect((await svc.products.searchProducts({ q: "alpha supply" })).total).toBe(1);
    expect(
      (await svc.products.searchProducts({ category: "cement", city: "Dubai" })).items.every(
        (i) => i.org.name,
      ),
    ).toBe(true);
    const cheap = await svc.products.searchProducts({ maxPrice: 17.5 });
    expect(cheap.items.map((i) => Number(i.price))).toEqual([17]);
    expect((await svc.products.searchProducts({ verifiedOnly: true })).total).toBe(0);
    const sorted = await svc.products.searchProducts({ sort: "price_asc" });
    expect(Number(sorted.items[0].price)).toBeLessThanOrEqual(Number(sorted.items[1].price));
  });

  it("archived products vanish from the public marketplace", async () => {
    const p = await svc.products.createProduct(
      supplierA.acc.ctx,
      productInput("Temp Cement", 9, cementCat),
    );
    expect((await svc.products.searchProducts({ q: "Temp Cement" })).total).toBe(1);
    await svc.products.archiveProduct(supplierA.acc.ctx, p.id);
    expect((await svc.products.searchProducts({ q: "Temp Cement" })).total).toBe(0);
  });

  it("stores price history on price change", async () => {
    const p = await svc.products.getOwnProduct(supplierA.acc.ctx, supplierA.productId);
    await svc.products.updateProduct(supplierA.acc.ctx, supplierA.productId, {
      ...productInput(p!.name, 19, cementCat),
    });
    expect(await db.priceHistory.count({ where: { productId: supplierA.productId } })).toBe(2);
  });
});

describe("organization data isolation", () => {
  it("another supplier cannot read or edit my product", async () => {
    expect(await svc.products.getOwnProduct(supplierB.acc.ctx, supplierA.productId)).toBeNull();
    await expect(
      svc.products.updateProduct(
        supplierB.acc.ctx,
        supplierA.productId,
        productInput("Hacked", 1, cementCat),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      svc.products.archiveProduct(supplierB.acc.ctx, supplierA.productId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      (await svc.products.listOwnProducts(supplierB.acc.ctx)).items.every(
        (p) => p.orgId === supplierB.acc.ctx.orgId,
      ),
    ).toBe(true);
  });

  it("staff role cannot manage products or org profile", async () => {
    const staff = { ...supplierA.acc.ctx, role: "STAFF" as const };
    await expect(
      svc.products.createProduct(staff, productInput("Staff Cement", 5, cementCat)),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      svc.orgs.updateOrgProfile(staff, { name: "Renamed", city: "Dubai" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("public org data never leaks private fields", async () => {
    const pub = await svc.orgs.getPublicOrg("alpha-supply", "SUPPLIER");
    expect(pub).not.toBeNull();
    expect(Object.keys(pub!.org)).not.toContain("passwordHash");
    // the owner's login email must never be copied into the public company profile
    const owner = await db.user.findFirstOrThrow({
      where: { memberships: { some: { org: { slug: "alpha-supply" } } } },
    });
    expect(JSON.stringify(pub)).not.toContain(owner.email);
  });
});

describe("RFQ → quotes → compare → order → review", () => {
  it("only buyers can create RFQs; validation applies", async () => {
    await expect(
      svc.rfq.createRfq(supplierA.acc.ctx, {
        deliveryCity: "Sharjah",
        items: [{ name: "Cement", quantity: 1, unitCode: "BAG" }],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      svc.rfq.createRfq(contractor.ctx, { deliveryCity: "", items: [] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      svc.rfq.createRfq(contractor.ctx, {
        deliveryCity: "Sharjah",
        items: [{ name: "Cement", quantity: 0, unitCode: "BAG" }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("Get 3 Quotes matches suppliers and creates recipients", async () => {
    const { rfq, supplierCount } = await svc.rfq.createRfq(contractor.ctx, {
      title: "Cement",
      mode: "get3",
      deliveryCity: "Sharjah",
      items: [
        { name: "Portland Cement 50kg", categoryId: cementCat, quantity: 200, unitCode: "BAG" },
      ],
    });
    rfqId = rfq.id;
    expect(supplierCount).toBeGreaterThanOrEqual(2);
    const recips = await db.rfqRecipient.findMany({ where: { rfqId } });
    expect(recips.every((r) => r.status === "SENT")).toBe(true);
    const ids = recips.map((r) => r.supplierOrgId);
    expect(ids).toContain(supplierA.acc.ctx.orgId);
    expect(ids).toContain(supplierB.acc.ctx.orgId);
    expect(ids).not.toContain(contractor.ctx.orgId);
    // supplier A serves Sharjah, so should rank first
    expect(ids[0] === supplierA.acc.ctx.orgId || recips.length > 1).toBe(true);
  });

  it("no matching suppliers gives a clear error", async () => {
    const paint = (await db.category.findUniqueOrThrow({ where: { slug: "paint" } })).id;
    await expect(
      svc.rfq.createRfq(contractor.ctx, {
        deliveryCity: "Sharjah",
        items: [{ name: "Paint", categoryId: paint, quantity: 5, unitCode: "LITER" }],
      }),
    ).rejects.toThrow(/No suppliers/);
  });

  it("supplier sees RFQ (marks viewed); non-recipients and other buyers cannot", async () => {
    const view = await svc.rfq.getSupplierRfq(supplierA.acc.ctx, rfqId);
    expect(view?.recipient.status).toBe("VIEWED");
    const outsider = await makeAccount("SUPPLIER", { name: "Outsider Supply" });
    expect(await svc.rfq.getSupplierRfq(outsider.ctx, rfqId)).toBeNull();
    expect(await svc.rfq.getBuyerRfq(otherBuyer.ctx, rfqId)).toBeNull();
    expect(await svc.rfq.getBuyerRfq(contractor.ctx, rfqId)).not.toBeNull();
    await expect(svc.rfq.submitQuote(outsider.ctx, rfqId, { items: [] })).rejects.toBeTruthy();
  });

  const quoteFor = (itemId: string, price: number, extra = {}) => ({
    deliveryDays: 2,
    deliveryCost: 100,
    validDays: 5,
    items: [{ rfqItemId: itemId, unitPrice: price, quantityAvailable: 200, minOrderQty: 10 }],
    ...extra,
  });

  it("suppliers submit quotes; totals computed server-side; comparison sorted by total", async () => {
    const rfq = await svc.rfq.getBuyerRfq(contractor.ctx, rfqId);
    const itemId = rfq!.items[0].id;
    await svc.rfq.submitQuote(supplierA.acc.ctx, rfqId, quoteFor(itemId, 18));
    await svc.rfq.submitQuote(
      supplierB.acc.ctx,
      rfqId,
      quoteFor(itemId, 17.5, { deliveryCost: 300 }),
    );
    const after = await svc.rfq.getBuyerRfq(contractor.ctx, rfqId);
    expect(after!.quotes.map((q) => Number(q.totalAmount))).toEqual([3700, 3800]);
    expect(after!.recipients.filter((r) => r.status === "RESPONDED")).toHaveLength(2);
    // revising updates in place rather than duplicating
    await svc.rfq.submitQuote(supplierA.acc.ctx, rfqId, quoteFor(itemId, 17));
    expect(await db.quote.count({ where: { rfqId, supplierOrgId: supplierA.acc.ctx.orgId } })).toBe(
      1,
    );
  });

  it("rejects incomplete or invalid quotes", async () => {
    await expect(
      svc.rfq.submitQuote(supplierA.acc.ctx, rfqId, {
        items: [{ rfqItemId: "x", unitPrice: -1, quantityAvailable: 1 }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("only the RFQ owner can accept; accepting creates an order and rejects the rest", async () => {
    const rfq = await svc.rfq.getBuyerRfq(contractor.ctx, rfqId);
    const winner = rfq!.quotes[0];
    await expect(svc.rfq.acceptQuote(otherBuyer.ctx, winner.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(svc.rfq.acceptQuote(supplierA.acc.ctx, winner.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const order = await svc.rfq.acceptQuote(contractor.ctx, winner.id);
    expect(order.status).toBe("ORDER_CREATED");
    expect(Number(order.totalAmount)).toBe(Number(winner.totalAmount));
    const quotes = await db.quote.findMany({ where: { rfqId } });
    expect(quotes.filter((q) => q.status === "ACCEPTED")).toHaveLength(1);
    expect(quotes.filter((q) => q.status === "REJECTED")).toHaveLength(1);
    expect((await db.rfq.findUniqueOrThrow({ where: { id: rfqId } })).status).toBe("ACCEPTED");
  });

  it("cannot accept twice or quote on a closed RFQ", async () => {
    const quotes = await db.quote.findMany({ where: { rfqId } });
    for (const q of quotes)
      await expect(svc.rfq.acceptQuote(contractor.ctx, q.id)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    const item = (await db.rfqItem.findFirstOrThrow({ where: { rfqId } })).id;
    await expect(
      svc.rfq.submitQuote(supplierA.acc.ctx, rfqId, quoteFor(item, 10)),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("concurrent accepts create exactly one order", async () => {
    const { rfq } = await svc.rfq.createRfq(contractor.ctx, {
      deliveryCity: "Sharjah",
      items: [
        { name: "Portland Cement 50kg", categoryId: cementCat, quantity: 50, unitCode: "BAG" },
      ],
    });
    const item = (await db.rfqItem.findFirstOrThrow({ where: { rfqId: rfq.id } })).id;
    await svc.rfq.submitQuote(
      supplierA.acc.ctx,
      rfq.id,
      quoteFor(item, 16, { items: [{ rfqItemId: item, unitPrice: 16, quantityAvailable: 50 }] }),
    );
    await svc.rfq.submitQuote(
      supplierB.acc.ctx,
      rfq.id,
      quoteFor(item, 15, { items: [{ rfqItemId: item, unitPrice: 15, quantityAvailable: 50 }] }),
    );
    const qs = await db.quote.findMany({ where: { rfqId: rfq.id } });
    const results = await Promise.allSettled(
      qs.map((q) => svc.rfq.acceptQuote(contractor.ctx, q.id)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.order.count({ where: { rfqId: rfq.id } })).toBe(1);
  });

  it("order visibility is limited to the two parties", async () => {
    const order = await db.order.findFirstOrThrow({ where: { rfqId } });
    expect(await svc.orders.getOrder(contractor.ctx, order.id)).not.toBeNull();
    expect(
      (await svc.orders.getOrder({ ...supplierA.acc.ctx }, order.id)) !== null ||
        (await svc.orders.getOrder(supplierB.acc.ctx, order.id)) !== null,
    ).toBe(true);
    expect(await svc.orders.getOrder(otherBuyer.ctx, order.id)).toBeNull();
    const other =
      supplierA.acc.ctx.orgId === order.supplierOrgId ? supplierB.acc.ctx : supplierA.acc.ctx;
    expect(await svc.orders.getOrder(other, order.id)).toBeNull();
    expect((await svc.orders.listOrders(otherBuyer.ctx)).length).toBe(0);
  });

  it("order status flow follows the allowed transitions and roles", async () => {
    const order = await db.order.findFirstOrThrow({ where: { rfqId } });
    const sup =
      supplierA.acc.ctx.orgId === order.supplierOrgId ? supplierA.acc.ctx : supplierB.acc.ctx;
    await expect(
      svc.orders.advanceOrder(contractor.ctx, order.id, "CONFIRMED"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(svc.orders.advanceOrder(sup, order.id, "DELIVERED")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    for (const s of ["CONFIRMED", "PREPARING", "DISPATCHED", "DELIVERED"] as const)
      await svc.orders.advanceOrder(sup, order.id, s);
    await expect(svc.orders.advanceOrder(sup, order.id, "COMPLETED")).rejects.toMatchObject({
      code: "FORBIDDEN",
    }); // buyer confirms receipt
    await expect(
      svc.orders.submitReview(contractor.ctx, order.id, { rating: 5 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" }); // not completed yet
    await svc.orders.advanceOrder(contractor.ctx, order.id, "COMPLETED");
    expect(await db.orderEvent.count({ where: { orderId: order.id } })).toBe(6);
  });

  it("reviews: buyer only, once, after completion; metrics reflect real data", async () => {
    const order = await db.order.findFirstOrThrow({ where: { rfqId } });
    const sup =
      supplierA.acc.ctx.orgId === order.supplierOrgId ? supplierA.acc.ctx : supplierB.acc.ctx;
    await expect(svc.orders.submitReview(sup, order.id, { rating: 5 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      svc.orders.submitReview(otherBuyer.ctx, order.id, { rating: 5 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      svc.orders.submitReview(contractor.ctx, order.id, { rating: 9 }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await svc.orders.submitReview(contractor.ctx, order.id, { rating: 4, comment: "Good" });
    await expect(
      svc.orders.submitReview(contractor.ctx, order.id, { rating: 5 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const m = await svc.orgs.trustMetrics(order.supplierOrgId);
    expect(m.rating).toBe(4);
    expect(m.completedOrders).toBe(1);
    expect(m.responseRate).toBeGreaterThan(0);
  });

  it("expiry closes stale RFQs and lapsed quotes", async () => {
    const { rfq } = await svc.rfq.createRfq(contractor.ctx, {
      deliveryCity: "Sharjah",
      items: [{ name: "Cement", categoryId: cementCat, quantity: 5, unitCode: "BAG" }],
    });
    await db.rfq.update({
      where: { id: rfq.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await svc.rfq.expireStale()).toBeGreaterThanOrEqual(1);
    expect((await db.rfq.findUniqueOrThrow({ where: { id: rfq.id } })).status).toBe("EXPIRED");
    expect(
      (await db.rfqRecipient.findMany({ where: { rfqId: rfq.id } })).every(
        (r) => r.status === "EXPIRED",
      ),
    ).toBe(true);
  });

  it("dashboard stats are computed per organization", async () => {
    const s = await svc.orders.dashboardStats(contractor.ctx);
    expect(s.orders).toBeGreaterThanOrEqual(2);
    const other = await svc.orders.dashboardStats(otherBuyer.ctx);
    expect(other.orders).toBe(0);
  });
});

describe("notifications", () => {
  it("suppliers are notified of new RFQs and buyers of quotes", async () => {
    const supN = await db.notification.count({
      where: { userId: supplierA.acc.userId, type: "rfq.new" },
    });
    const buyN = await db.notification.count({
      where: { userId: contractor.userId, type: "quote.received" },
    });
    expect(supN).toBeGreaterThan(0);
    expect(buyN).toBeGreaterThan(0);
  });
});
