import { z } from "zod";
import { db, Prisma } from "@bmn/database";
import { assertCan, assertVerified, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { fieldErrorsFrom } from "./accounts";
import { audit, notifyOrg } from "./notify";
import { hit } from "../rate-limit";
import {
  normalizeForDuplicate,
  ratingBreakdown,
  REPORT_REASON_VALUES,
  roundRating,
  screenReviewText,
  type RatingBreakdown,
} from "@/lib/reviews";
import type { AdminActor } from "./admin";
import { assertAdmin } from "./admin";

type Tx = Prisma.TransactionClient;

const photoUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v.startsWith("/api/files/") || /^https:\/\//i.test(v), "Invalid photo");

export const productReviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5, "Choose a rating"),
  title: z.string().trim().max(100, "Keep the title under 100 characters").optional().default(""),
  body: z.string().trim().max(2000, "Keep the review under 2000 characters").optional().default(""),
  photos: z.array(photoUrl).max(3, "Add up to 3 photos").optional().default([]),
});

function parseOrThrow<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "Please fix the highlighted fields.",
      "VALIDATION",
      fieldErrorsFrom(parsed.error),
    );
  return parsed.data;
}

/** Recomputes the cached average and count from published reviews only. */
async function recomputeProductRating(tx: Tx, productId: string) {
  const agg = await tx.productReview.aggregate({
    where: { productId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: true,
  });
  await tx.product.update({
    where: { id: productId },
    data: { ratingAvg: roundRating(agg._avg.rating), ratingCount: agg._count },
  });
}

// ───────────────────────── eligibility ─────────────────────────

export type ReviewEligibility =
  | { state: "anon" }
  | { state: "own" }
  | { state: "not_purchased" }
  | { state: "eligible"; orderId: string }
  | {
      state: "reviewed";
      review: {
        id: string;
        rating: number;
        title: string | null;
        body: string | null;
        photos: string[];
      };
    };

/** Only a buyer that received this product (delivered or completed order) may review it. */
async function findPurchase(orgId: string, productId: string) {
  return db.order.findFirst({
    where: {
      buyerOrgId: orgId,
      status: { in: ["DELIVERED", "COMPLETED"] },
      items: { some: { productId } },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
}

export async function reviewEligibility(
  ctx: Ctx | null,
  product: { id: string; orgId: string },
): Promise<ReviewEligibility> {
  if (!ctx) return { state: "anon" };
  if (ctx.orgId === product.orgId) return { state: "own" };
  const existing = await db.productReview.findUnique({
    where: { productId_authorOrgId: { productId: product.id, authorOrgId: ctx.orgId } },
    select: { id: true, rating: true, title: true, body: true, photos: true },
  });
  if (existing) return { state: "reviewed", review: existing };
  const purchase = await findPurchase(ctx.orgId, product.id);
  return purchase ? { state: "eligible", orderId: purchase.id } : { state: "not_purchased" };
}

// ───────────────────────── writing ─────────────────────────

/** Creates or updates this organisation's single review of a product. */
export async function saveProductReview(ctx: Ctx, productId: string, raw: unknown) {
  assertCan(ctx, "order.view");
  assertVerified(ctx);
  const rl = hit(`product-review:${ctx.userId}`, 10, 10 * 60_000);
  if (!rl.ok)
    throw new AppError(`Slow down: try again in ${rl.retryAfterSec} seconds.`, "RATE_LIMIT");
  const d = parseOrThrow(productReviewSchema, raw);
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, orgId: true },
  });
  if (!product) throw new AppError("Product not found", "NOT_FOUND");
  if (product.orgId === ctx.orgId)
    throw new AppError("You cannot review your own product.", "FORBIDDEN");
  const purchase = await findPurchase(ctx.orgId, productId);
  if (!purchase)
    throw new AppError(
      "Only buyers who received this product in an order can review it.",
      "FORBIDDEN",
    );
  const problem = screenReviewText(d.title, d.body);
  if (problem) throw new AppError(problem, "VALIDATION", { body: problem });
  const norm = normalizeForDuplicate(d.body);
  if (norm.length >= 20) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const recent = await db.productReview.findMany({
      where: { authorId: ctx.userId, createdAt: { gte: since }, NOT: { productId } },
      select: { body: true },
      take: 100,
    });
    if (recent.some((r) => normalizeForDuplicate(r.body) === norm))
      throw new AppError(
        "You already used this exact text on another review. Please describe this product in your own words.",
        "VALIDATION",
        { body: "Please write something specific to this product." },
      );
  }
  const { review, created } = await db.$transaction(async (tx) => {
    const existing = await tx.productReview.findUnique({
      where: { productId_authorOrgId: { productId, authorOrgId: ctx.orgId } },
    });
    const data = {
      rating: d.rating,
      title: d.title || null,
      body: d.body || null,
      photos: d.photos,
    };
    const review = existing
      ? await tx.productReview.update({ where: { id: existing.id }, data })
      : await tx.productReview.create({
          data: {
            ...data,
            productId,
            authorOrgId: ctx.orgId,
            authorId: ctx.userId,
            orderId: purchase.id,
          },
        });
    await recomputeProductRating(tx, productId);
    return { review, created: !existing };
  });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: created ? "product_review.created" : "product_review.updated",
    entity: "ProductReview",
    entityId: review.id,
  });
  if (created)
    await notifyOrg({
      orgId: product.orgId,
      type: "review.received",
      title: `New ${d.rating}★ review on ${product.name}`,
      href: `/products/${productId}#reviews`,
    });
  return review;
}

async function loadReviewForFeedback(ctx: Ctx, reviewId: string) {
  const review = await db.productReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      status: true,
      authorId: true,
      authorOrgId: true,
      product: { select: { orgId: true, id: true } },
    },
  });
  if (!review || review.status !== "PUBLISHED") throw new AppError("Review not found", "NOT_FOUND");
  if (
    review.authorId === ctx.userId ||
    review.authorOrgId === ctx.orgId ||
    review.product.orgId === ctx.orgId
  )
    throw new AppError("You cannot do that on a review from your own company.", "FORBIDDEN");
  return review;
}

/** Marks a review helpful, or removes the mark if this user already gave it. */
export async function toggleHelpful(ctx: Ctx, reviewId: string) {
  const rl = hit(`review-vote:${ctx.userId}`, 60, 60_000);
  if (!rl.ok) throw new AppError("Too many votes. Please wait a moment.", "RATE_LIMIT");
  await loadReviewForFeedback(ctx, reviewId);
  return db.$transaction(async (tx) => {
    const existing = await tx.reviewVote.findUnique({
      where: { productReviewId_userId: { productReviewId: reviewId, userId: ctx.userId } },
    });
    if (existing) {
      await tx.reviewVote.delete({ where: { id: existing.id } });
      const r = await tx.productReview.update({
        where: { id: reviewId },
        data: { helpfulCount: { decrement: 1 } },
        select: { helpfulCount: true },
      });
      return { voted: false, helpfulCount: r.helpfulCount };
    }
    await tx.reviewVote.create({ data: { productReviewId: reviewId, userId: ctx.userId } });
    const r = await tx.productReview.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: 1 } },
      select: { helpfulCount: true },
    });
    return { voted: true, helpfulCount: r.helpfulCount };
  });
}

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASON_VALUES, { message: "Choose a reason" }),
  note: z.string().trim().max(300).optional().default(""),
});

/** One report per user per review. Reports queue the review for admin moderation; nothing is hidden automatically. */
export async function reportReview(ctx: Ctx, reviewId: string, raw: unknown) {
  const rl = hit(`review-report:${ctx.userId}`, 10, 3_600_000);
  if (!rl.ok) throw new AppError("Too many reports. Please try again later.", "RATE_LIMIT");
  const d = parseOrThrow(reportSchema, raw);
  await loadReviewForFeedback(ctx, reviewId);
  try {
    await db.$transaction(async (tx) => {
      await tx.reviewReport.create({
        data: {
          productReviewId: reviewId,
          reporterId: ctx.userId,
          reason: d.reason,
          note: d.note || null,
        },
      });
      await tx.productReview.update({
        where: { id: reviewId },
        data: { reportCount: { increment: 1 } },
      });
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new AppError("You already reported this review.", "CONFLICT");
    throw e;
  }
}

export const replySchema = z.object({
  text: z.string().trim().min(2, "Write a reply").max(1000, "Keep the reply under 1000 characters"),
});

/** The reviewed company may publish one public reply per review (editable). */
export async function replyToReview(
  ctx: Ctx,
  kind: "PRODUCT" | "ORDER",
  reviewId: string,
  raw: unknown,
) {
  assertCan(ctx, "order.view");
  const { text } = parseOrThrow(replySchema, raw);
  const problem = screenReviewText(text);
  if (problem) throw new AppError(problem, "VALIDATION", { text: problem });
  if (kind === "PRODUCT") {
    const r = await db.productReview.findUnique({
      where: { id: reviewId },
      select: { authorOrgId: true, productId: true, product: { select: { orgId: true } } },
    });
    if (!r || r.product.orgId !== ctx.orgId) throw new AppError("Review not found", "NOT_FOUND");
    await db.productReview.update({
      where: { id: reviewId },
      data: { reply: text, repliedAt: new Date() },
    });
    await notifyOrg({
      orgId: r.authorOrgId,
      type: "review.reply",
      title: "The supplier replied to your review",
      href: `/products/${r.productId}#reviews`,
    });
  } else {
    const r = await db.review.findUnique({
      where: { id: reviewId },
      select: { authorOrgId: true, subjectOrgId: true, orderId: true },
    });
    if (!r || r.subjectOrgId !== ctx.orgId) throw new AppError("Review not found", "NOT_FOUND");
    await db.review.update({
      where: { id: reviewId },
      data: { reply: text, repliedAt: new Date() },
    });
    await notifyOrg({
      orgId: r.authorOrgId,
      type: "review.reply",
      title: "The supplier replied to your review",
      href: `/dashboard/orders/${r.orderId}`,
    });
  }
}

// ───────────────────────── reading ─────────────────────────

export type ReviewSort = "helpful" | "newest" | "highest" | "lowest";

export async function getProductRatingBreakdown(productId: string): Promise<RatingBreakdown> {
  const rows = await db.productReview.groupBy({
    by: ["rating"],
    where: { productId, status: "PUBLISHED" },
    _count: true,
  });
  return ratingBreakdown(Object.fromEntries(rows.map((r) => [r.rating, r._count])));
}

export async function listProductReviews(
  productId: string,
  opts: { sort?: ReviewSort; page?: number; viewerUserId?: string | null } = {},
) {
  const pageSize = 8;
  const page = Math.max(1, opts.page ?? 1);
  const orderBy: Prisma.ProductReviewOrderByWithRelationInput[] =
    opts.sort === "newest"
      ? [{ createdAt: "desc" }]
      : opts.sort === "highest"
        ? [{ rating: "desc" }, { createdAt: "desc" }]
        : opts.sort === "lowest"
          ? [{ rating: "asc" }, { createdAt: "desc" }]
          : [{ helpfulCount: "desc" }, { createdAt: "desc" }];
  const where = { productId, status: "PUBLISHED" as const };
  const [total, rows] = await Promise.all([
    db.productReview.count({ where }),
    db.productReview.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        authorOrg: { select: { name: true } },
        votes: opts.viewerUserId
          ? { where: { userId: opts.viewerUserId }, select: { id: true } }
          : false,
      },
    }),
  ]);
  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      photos: r.photos,
      helpfulCount: r.helpfulCount,
      reply: r.reply,
      repliedAt: r.repliedAt,
      createdAt: r.createdAt,
      authorName: r.authorOrg.name,
      isOwn: !!opts.viewerUserId && r.authorId === opts.viewerUserId,
      viewerVoted: Array.isArray(r.votes) && r.votes.length > 0,
    })),
  };
}

async function aggregateRating(where: Prisma.ProductReviewWhereInput) {
  const agg = await db.productReview.aggregate({
    where: { status: "PUBLISHED", ...where },
    _avg: { rating: true },
    _count: true,
  });
  return { average: roundRating(agg._avg.rating), count: agg._count };
}

/** A brand's rating is the average of published reviews across all of its products. */
export const getBrandRating = (brandId: string) => aggregateRating({ product: { brandId } });
export const getManufacturerRating = (manufacturerId: string) =>
  aggregateRating({ product: { manufacturerId } });

// ───────────────────────── moderation (platform admin) ─────────────────────────

export async function getModerationQueue(actor: AdminActor) {
  assertAdmin(actor);
  const [reported, hidden, orderReviews] = await Promise.all([
    db.productReview.findMany({
      where: { reportCount: { gt: 0 }, status: "PUBLISHED" },
      orderBy: [{ reportCount: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        product: { select: { id: true, name: true, org: { select: { name: true } } } },
        authorOrg: { select: { name: true } },
        reports: { where: { resolvedAt: null }, select: { reason: true, note: true } },
      },
    }),
    db.productReview.findMany({
      where: { status: "HIDDEN" },
      orderBy: { updatedAt: "desc" },
      take: 25,
      include: {
        product: { select: { id: true, name: true } },
        authorOrg: { select: { name: true } },
      },
    }),
    db.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        authorOrg: { select: { name: true } },
        subjectOrg: { select: { name: true } },
      },
    }),
  ]);
  return { reported, hidden, orderReviews };
}

export type ModerationAction = "HIDE" | "RESTORE" | "DISMISS_REPORTS";

export async function moderateReview(
  actor: AdminActor,
  kind: "PRODUCT" | "ORDER",
  reviewId: string,
  action: ModerationAction,
) {
  assertAdmin(actor);
  if (kind === "ORDER") {
    if (action === "DISMISS_REPORTS")
      throw new AppError("Order reviews have no reports to dismiss.", "VALIDATION");
    const res = await db.review.updateMany({
      where: { id: reviewId },
      data: { status: action === "HIDE" ? "HIDDEN" : "PUBLISHED" },
    });
    if (!res.count) throw new AppError("Review not found", "NOT_FOUND");
  } else {
    await db.$transaction(async (tx) => {
      const r = await tx.productReview.findUnique({
        where: { id: reviewId },
        select: { productId: true },
      });
      if (!r) throw new AppError("Review not found", "NOT_FOUND");
      if (action === "DISMISS_REPORTS") {
        await tx.reviewReport.updateMany({
          where: { productReviewId: reviewId, resolvedAt: null },
          data: { resolvedAt: new Date() },
        });
        await tx.productReview.update({ where: { id: reviewId }, data: { reportCount: 0 } });
      } else {
        await tx.productReview.update({
          where: { id: reviewId },
          data: {
            status: action === "HIDE" ? "HIDDEN" : "PUBLISHED",
            ...(action === "HIDE" ? { reportCount: 0 } : {}),
          },
        });
        if (action === "HIDE")
          await tx.reviewReport.updateMany({
            where: { productReviewId: reviewId, resolvedAt: null },
            data: { resolvedAt: new Date() },
          });
        await recomputeProductRating(tx, r.productId);
      }
    });
  }
  await audit({
    actorId: actor.userId,
    action: `review.${action.toLowerCase()}`,
    entity: kind === "ORDER" ? "Review" : "ProductReview",
    entityId: reviewId,
  });
}
