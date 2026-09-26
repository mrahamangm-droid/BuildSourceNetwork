import { beforeAll, describe, expect, it } from "vitest";
import { makeAccount, resetDb } from "./helpers";

let db: typeof import("@bmn/database").db;
let reviews: typeof import("@/server/services/reviews");
let orders: typeof import("@/server/services/orders");
let products: typeof import("@/server/services/products");

type Acc = Awaited<ReturnType<typeof makeAccount>>;
let supplier: Acc;
let buyer: Acc;
let stranger: Acc;
let other: Acc;
let productId: string;
let brandedId: string;
let orderId: string;

async function makeOrder(
  buyerAcc: Acc,
  supplierAcc: Acc,
  prodId: string,
  status: "DELIVERED" | "ORDER_CREATED",
) {
  return db.order.create({
    data: {
      number: `T-${Math.random().toString(36).slice(2, 10)}`,
      buyerOrgId: buyerAcc.ctx.orgId,
      supplierOrgId: supplierAcc.ctx.orgId,
      createdById: buyerAcc.userId,
      status,
      subtotal: 100,
      totalAmount: 100,
      items: {
        create: [
          {
            name: "Item",
            quantity: 1,
            unitCode: "BAG",
            unitPrice: 100,
            lineTotal: 100,
            productId: prodId,
          },
        ],
      },
    },
  });
}

beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
  reviews = await import("@/server/services/reviews");
  orders = await import("@/server/services/orders");
  products = await import("@/server/services/products");
  supplier = await makeAccount("SUPPLIER", { name: "Review Supply" });
  buyer = await makeAccount("CONTRACTOR", { name: "Buyer Co" });
  stranger = await makeAccount("CONTRACTOR", { name: "Stranger Co" });
  other = await makeAccount("CONTRACTOR", { name: "Other Co" });
  const cat = await db.category.findFirstOrThrow();
  const base = { categoryId: cat.id, unitCode: "BAG", price: 30 };
  productId = (
    await products.createProduct(supplier.ctx, {
      ...base,
      name: "Reviewed cement",
      brandName: "Sika",
    })
  ).id;
  brandedId = (
    await products.createProduct(supplier.ctx, {
      ...base,
      name: "Second sika item",
      brandName: "Sika",
    })
  ).id;
  orderId = (await makeOrder(buyer, supplier, productId, "DELIVERED")).id;
  await makeOrder(buyer, supplier, brandedId, "DELIVERED");
  await makeOrder(stranger, supplier, productId, "ORDER_CREATED"); // not delivered yet
  await makeOrder(other, supplier, productId, "DELIVERED");
});

describe("product reviews", () => {
  it("only lets a buyer who received the product review it", async () => {
    await expect(
      reviews.saveProductReview(stranger.ctx, productId, { rating: 5 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      reviews.saveProductReview(supplier.ctx, productId, { rating: 5 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const e = await reviews.reviewEligibility(buyer.ctx, {
      id: productId,
      orgId: supplier.ctx.orgId,
    });
    expect(e).toMatchObject({ state: "eligible" });
    expect(
      await reviews.reviewEligibility(stranger.ctx, { id: productId, orgId: supplier.ctx.orgId }),
    ).toEqual({ state: "not_purchased" });
    expect(
      await reviews.reviewEligibility(null, { id: productId, orgId: supplier.ctx.orgId }),
    ).toEqual({ state: "anon" });
  });

  it("validates, screens spam and keeps the product rating in step", async () => {
    await expect(
      reviews.saveProductReview(buyer.ctx, productId, { rating: 9 }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      reviews.saveProductReview(buyer.ctx, productId, {
        rating: 4,
        body: "buy at http://spam.example",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      reviews.saveProductReview(buyer.ctx, productId, {
        rating: 4,
        photos: ["javascript:alert(1)"],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    const r = await reviews.saveProductReview(buyer.ctx, productId, {
      rating: 4,
      title: "Solid",
      body: "Bags arrived intact and set well.",
    });
    expect(r.orderId).toBeTruthy();
    let p = await db.product.findUniqueOrThrow({ where: { id: productId } });
    expect(p.ratingCount).toBe(1);
    expect(Number(p.ratingAvg)).toBe(4);

    // one review per company: a second save edits it instead of adding another
    await reviews.saveProductReview(buyer.ctx, productId, {
      rating: 5,
      body: "Even better after a month.",
    });
    expect(await db.productReview.count({ where: { productId } })).toBe(1);
    p = await db.product.findUniqueOrThrow({ where: { id: productId } });
    expect(Number(p.ratingAvg)).toBe(5);

    await reviews.saveProductReview(other.ctx, productId, {
      rating: 2,
      body: "Two bags were damaged on arrival.",
    });
    p = await db.product.findUniqueOrThrow({ where: { id: productId } });
    expect(p.ratingCount).toBe(2);
    expect(Number(p.ratingAvg)).toBe(3.5);
    const b = await reviews.getProductRatingBreakdown(productId);
    expect(b).toMatchObject({ count: 2, average: 3.5 });
  });

  it("rejects the same text pasted on another product", async () => {
    const text = "Excellent quality and fast delivery, will order again.";
    await reviews.saveProductReview(buyer.ctx, brandedId, { rating: 5, body: text });
    // same author, same words, different product → refused
    const third = await makeOrder(buyer, supplier, productId, "DELIVERED");
    expect(third.id).toBeTruthy();
    await db.productReview.deleteMany({ where: { productId, authorOrgId: buyer.ctx.orgId } });
    await expect(
      reviews.saveProductReview(buyer.ctx, productId, { rating: 5, body: text }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await reviews.saveProductReview(buyer.ctx, productId, {
      rating: 5,
      body: "Bags were dry and well stacked.",
    });
  });

  it("supports helpful votes, reports, replies and brand ratings", async () => {
    const rev = await db.productReview.findFirstOrThrow({
      where: { productId, authorOrgId: other.ctx.orgId },
    });
    // a company cannot vote on its own review, or the supplier on reviews of its own product
    await expect(reviews.toggleHelpful(other.ctx, rev.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(reviews.toggleHelpful(supplier.ctx, rev.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await reviews.toggleHelpful(stranger.ctx, rev.id)).toEqual({
      voted: true,
      helpfulCount: 1,
    });
    expect(await reviews.toggleHelpful(buyer.ctx, rev.id)).toEqual({
      voted: true,
      helpfulCount: 2,
    });
    expect(await reviews.toggleHelpful(buyer.ctx, rev.id)).toEqual({
      voted: false,
      helpfulCount: 1,
    });

    await expect(
      reviews.reportReview(stranger.ctx, rev.id, { reason: "NOPE" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await reviews.reportReview(stranger.ctx, rev.id, { reason: "FAKE", note: "never bought it" });
    await expect(
      reviews.reportReview(stranger.ctx, rev.id, { reason: "SPAM" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await db.productReview.findUniqueOrThrow({ where: { id: rev.id } })).reportCount).toBe(
      1,
    );

    await expect(
      reviews.replyToReview(buyer.ctx, "PRODUCT", rev.id, { text: "Thanks" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await reviews.replyToReview(supplier.ctx, "PRODUCT", rev.id, {
      text: "Sorry about the damage; we have sent replacements.",
    });
    expect((await db.productReview.findUniqueOrThrow({ where: { id: rev.id } })).reply).toContain(
      "replacements",
    );

    const brand = await db.brand.findUniqueOrThrow({ where: { slug: "sika" } });
    const rating = await reviews.getBrandRating(brand.id);
    expect(rating.count).toBe(3);
    const list = await reviews.listProductReviews(productId, {
      sort: "lowest",
      viewerUserId: stranger.userId,
    });
    expect(list.items[0]?.rating).toBe(2);
    expect(list.items[0]?.viewerVoted).toBe(true);
  });

  it("moderation hides a review from ratings and restores it; only admins may moderate", async () => {
    const rev = await db.productReview.findFirstOrThrow({
      where: { productId, authorOrgId: other.ctx.orgId },
    });
    await expect(
      reviews.moderateReview(
        { userId: buyer.userId, isPlatformAdmin: false },
        "PRODUCT",
        rev.id,
        "HIDE",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = { userId: buyer.userId, isPlatformAdmin: true };
    const queue = await reviews.getModerationQueue(admin);
    expect(queue.reported.map((r) => r.id)).toContain(rev.id);

    await reviews.moderateReview(admin, "PRODUCT", rev.id, "HIDE");
    let p = await db.product.findUniqueOrThrow({ where: { id: productId } });
    expect(p.ratingCount).toBe(1); // only the buyer's published review is left
    expect((await reviews.listProductReviews(productId)).items.some((i) => i.id === rev.id)).toBe(
      false,
    );
    expect(
      (await db.reviewReport.findFirstOrThrow({ where: { productReviewId: rev.id } })).resolvedAt,
    ).not.toBeNull();

    await reviews.moderateReview(admin, "PRODUCT", rev.id, "RESTORE");
    p = await db.product.findUniqueOrThrow({ where: { id: productId } });
    expect(p.ratingCount).toBe(2);
    expect((await reviews.listProductReviews(productId)).total).toBe(2);
  });
});

describe("supplier (order) reviews keep working with the new fields", () => {
  it("stores title and photos, hides from trust metrics when moderated, allows one reply", async () => {
    await db.order.update({ where: { id: orderId }, data: { status: "COMPLETED" } });
    const r = await orders.submitReview(buyer.ctx, orderId, {
      rating: 5,
      comment: "Reliable supplier",
      title: "Would order again",
      photos: ["/api/files/abc"],
    });
    expect(r.title).toBe("Would order again");
    expect(r.photos).toEqual(["/api/files/abc"]);
    await expect(
      orders.submitReview(buyer.ctx, orderId, { rating: 5, comment: "call 0501234567 now" }),
    ).rejects.toBeTruthy();
    const svc = await import("@/server/services/orgs");
    expect((await svc.trustMetrics(supplier.ctx.orgId)).reviewCount).toBe(1);

    await reviews.replyToReview(supplier.ctx, "ORDER", r.id, { text: "Thank you for the trust." });
    await expect(
      reviews.replyToReview(buyer.ctx, "ORDER", r.id, { text: "hi" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const admin = { userId: buyer.userId, isPlatformAdmin: true };
    await reviews.moderateReview(admin, "ORDER", r.id, "HIDE");
    expect((await svc.trustMetrics(supplier.ctx.orgId)).reviewCount).toBe(0);
    await reviews.moderateReview(admin, "ORDER", r.id, "RESTORE");
    expect((await svc.trustMetrics(supplier.ctx.orgId)).reviewCount).toBe(1);
  });

  it("marketplace can filter and sort by rating", async () => {
    const top = await products.searchProducts({ sort: "rating" });
    expect(top.items[0]?.name).toBeDefined();
    const four = await products.searchProducts({ minRating: 4 });
    expect(four.items.every((i) => Number(i.ratingAvg) >= 4)).toBe(true);
  });
});
