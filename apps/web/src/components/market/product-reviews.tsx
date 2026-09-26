import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { RatingSummary, Stars } from "@/components/market/stars";
import { ProductReviewForm } from "@/components/market/product-review-form";
import { HelpfulButton, ReplyForm, ReportReviewForm } from "@/components/market/review-actions";
import {
  getBrandRating,
  getManufacturerRating,
  getProductRatingBreakdown,
  listProductReviews,
  reviewEligibility,
  type ReviewSort,
} from "@/server/services/reviews";
import type { Ctx } from "@/server/ctx";

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: "helpful", label: "Most helpful" },
  { value: "newest", label: "Newest" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

const fmt = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export async function ProductReviews({
  product,
  ctx,
  sort,
  page,
  basePath,
}: {
  product: { id: string; orgId: string; brandId: string | null; manufacturerId: string | null };
  ctx: Ctx | null;
  sort: ReviewSort;
  page: number;
  basePath: string;
}) {
  const [breakdown, list, eligibility, brand, mfr] = await Promise.all([
    getProductRatingBreakdown(product.id),
    listProductReviews(product.id, { sort, page, viewerUserId: ctx?.userId }),
    reviewEligibility(ctx, product),
    product.brandId ? getBrandRating(product.brandId) : null,
    product.manufacturerId ? getManufacturerRating(product.manufacturerId) : null,
  ]);
  const isOwner = !!ctx && ctx.orgId === product.orgId;
  const href = (s: ReviewSort, p = 1) => `${basePath}?rsort=${s}&rpage=${p}#reviews`;
  return (
    <section id="reviews" className="mt-10 scroll-mt-24">
      <h2 className="mb-3 text-xl font-semibold">Customer reviews</h2>
      <Card className="space-y-3">
        <RatingSummary breakdown={breakdown} />
        {brand?.count || mfr?.count ? (
          <p className="text-xs text-muted">
            {brand?.count && brand.average != null
              ? `Brand rating ${brand.average.toFixed(1)} across ${brand.count} review${brand.count === 1 ? "" : "s"}. `
              : ""}
            {mfr?.count && mfr.average != null
              ? `Manufacturer rating ${mfr.average.toFixed(1)} across ${mfr.count} review${mfr.count === 1 ? "" : "s"}.`
              : ""}
          </p>
        ) : null}
        <p className="text-xs text-muted">
          Only buyers who received this product in an order can review it.
        </p>
      </Card>

      <div className="mt-4">
        {eligibility.state === "anon" ? (
          <p className="text-sm">
            <Link className="text-brand-700 hover:underline" href="/login">
              Sign in
            </Link>{" "}
            to review products you bought.
          </p>
        ) : eligibility.state === "eligible" || eligibility.state === "reviewed" ? (
          <Card>
            <h3 className="font-semibold">
              {eligibility.state === "reviewed" ? "Your review" : "Review this product"}
            </h3>
            <p className="mb-3 text-sm text-muted">
              {eligibility.state === "reviewed"
                ? "You can edit it any time."
                : "You bought this product, so your review will carry a verified purchase mark."}
            </p>
            <ProductReviewForm
              productId={product.id}
              existing={eligibility.state === "reviewed" ? eligibility.review : undefined}
            />
          </Card>
        ) : null}
      </div>

      {list.total > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">Sort by</span>
            {SORTS.map((s) => (
              <Link
                key={s.value}
                href={href(s.value)}
                className={
                  sort === s.value
                    ? "font-semibold text-brand-700"
                    : "text-slate-600 hover:underline"
                }
              >
                {s.label}
              </Link>
            ))}
          </div>
          <div className="space-y-3">
            {list.items.map((r) => (
              <Card key={r.id} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} />
                  {r.title ? <p className="font-semibold">{r.title}</p> : null}
                  <Badge tone="green">Verified purchase</Badge>
                </div>
                <p className="text-xs text-muted">
                  {r.authorName} · {fmt(r.createdAt)}
                </p>
                {r.body ? (
                  <p className="whitespace-pre-line text-sm text-slate-700">{r.body}</p>
                ) : null}
                {r.photos.length ? (
                  <div className="flex flex-wrap gap-2">
                    {r.photos.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={u}
                          alt="Photo from the reviewer"
                          loading="lazy"
                          className="h-20 w-20 rounded-lg border border-line object-cover"
                        />
                      </a>
                    ))}
                  </div>
                ) : null}
                {r.reply ? (
                  <div className="rounded-lg bg-surface p-3 text-sm">
                    <p className="text-xs font-semibold text-muted">Reply from the supplier</p>
                    <p className="mt-1 whitespace-pre-line">{r.reply}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  {ctx && !r.isOwn && !isOwner && ctx.orgId ? (
                    <>
                      <HelpfulButton
                        reviewId={r.id}
                        productId={product.id}
                        voted={r.viewerVoted}
                        count={r.helpfulCount}
                      />
                      <ReportReviewForm reviewId={r.id} />
                    </>
                  ) : r.helpfulCount ? (
                    <span className="text-xs text-muted">{r.helpfulCount} found this helpful</span>
                  ) : null}
                </div>
                {isOwner ? (
                  <ReplyForm
                    kind="PRODUCT"
                    reviewId={r.id}
                    productId={product.id}
                    existing={r.reply}
                  />
                ) : null}
              </Card>
            ))}
          </div>
          {list.pages > 1 ? (
            <div className="mt-4 flex items-center gap-3 text-sm">
              {list.page > 1 ? (
                <Link className="text-brand-700 hover:underline" href={href(sort, list.page - 1)}>
                  ← Newer
                </Link>
              ) : null}
              <span className="text-muted">
                Page {list.page} of {list.pages}
              </span>
              {list.page < list.pages ? (
                <Link className="text-brand-700 hover:underline" href={href(sort, list.page + 1)}>
                  More →
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
