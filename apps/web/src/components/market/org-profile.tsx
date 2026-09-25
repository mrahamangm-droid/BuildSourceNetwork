import { notFound } from "next/navigation";
import { db } from "@bmn/database";
import { Badge, Card, LinkButton } from "@/components/ui";
import {
  Breadcrumbs,
  DemoBadge,
  JsonLd,
  ProductCard,
  VerifiedBadge,
} from "@/components/market/parts";
import { getPublicOrg } from "@/server/services/orgs";
import { searchProducts } from "@/server/services/products";
import { appUrl } from "@/lib/utils";
import { DEMO_LABEL } from "@bmn/config";

export async function loadOrg(slug: string, type: "SUPPLIER" | "STORE") {
  return getPublicOrg(slug, type);
}

export async function OrgProfile({
  slug,
  type,
  basePath,
}: {
  slug: string;
  type: "SUPPLIER" | "STORE";
  basePath: "suppliers" | "stores";
}) {
  const data = await getPublicOrg(slug, type);
  if (!data) notFound();
  const { org, metrics } = data;
  const [products, reviews] = await Promise.all([
    searchProducts({ supplier: slug, pageSize: 12 }),
    db.review.findMany({
      where: { subjectOrgId: org.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { authorOrg: { select: { name: true } } },
    }),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: org.name,
          url: `${appUrl()}/${basePath}/${org.slug}`,
          description: org.description ?? undefined,
          logo: org.logoUrl ?? undefined,
          address: org.city
            ? { "@type": "PostalAddress", addressLocality: org.city, addressCountry: "AE" }
            : undefined,
          aggregateRating: metrics.reviewCount
            ? {
                "@type": "AggregateRating",
                ratingValue: metrics.rating,
                reviewCount: metrics.reviewCount,
              }
            : undefined,
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: type === "SUPPLIER" ? "Suppliers" : "Stores", href: `/${basePath}` },
          { name: org.name },
        ]}
      />
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="h-32 bg-gradient-to-r from-slate-100 to-slate-200 sm:h-44">
          {org.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="flex flex-wrap items-start gap-4 p-5">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logoUrl}
              alt={`${org.name} logo`}
              className="-mt-12 h-20 w-20 rounded-xl border-4 border-white bg-white object-cover"
            />
          ) : (
            <div className="-mt-12 grid h-20 w-20 place-items-center rounded-xl border-4 border-white bg-brand-50 text-2xl font-bold text-brand-700">
              {org.name[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
            <div className="mt-1 flex flex-wrap gap-1">
              <VerifiedBadge status={org.verificationStatus} />
              <DemoBadge show={org.isDemo} />
              {org.city ? <Badge>{org.city}</Badge> : null}
            </div>
            {org.isDemo ? <p className="mt-2 text-xs text-amber-800">{DEMO_LABEL}.</p> : null}
          </div>
          {type === "SUPPLIER" ? (
            <LinkButton href={`/request-quotes?supplier=${org.id}&mode=custom`}>
              Request a quote
            </LinkButton>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {org.description ? (
            <Card>
              <h2 className="font-semibold">About</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{org.description}</p>
            </Card>
          ) : null}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Products ({products.total})</h2>
            {products.items.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {products.items.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No products listed yet.</p>
            )}
          </section>
          {reviews.length ? (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Reviews from completed orders</h2>
              <div className="space-y-3">
                {reviews.map((r) => (
                  <Card key={r.id}>
                    <p className="text-sm font-semibold">
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}{" "}
                      <span className="font-normal text-muted">· {r.authorOrg.name}</span>
                    </p>
                    {r.comment ? <p className="mt-1 text-sm text-slate-700">{r.comment}</p> : null}
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <aside className="space-y-4">
          <Card>
            <h2 className="font-semibold">Trust</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Rating</dt>
                <dd>
                  {metrics.rating
                    ? `${metrics.rating.toFixed(1)} (${metrics.reviewCount})`
                    : "No reviews yet"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Completed orders</dt>
                <dd>{metrics.completedOrders}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Quote response rate</dt>
                <dd>{metrics.responseRate == null ? "—" : `${metrics.responseRate}%`}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <h2 className="font-semibold">Contact & details</h2>
            <dl className="mt-2 space-y-1 text-sm">
              {org.phone ? (
                <div>
                  <dt className="text-muted">Phone</dt>
                  <dd>{org.phone}</dd>
                </div>
              ) : null}
              {org.email ? (
                <div>
                  <dt className="text-muted">Email</dt>
                  <dd>{org.email}</dd>
                </div>
              ) : null}
              {org.website ? (
                <div>
                  <dt className="text-muted">Website</dt>
                  <dd>
                    <a
                      className="text-brand-700 hover:underline"
                      rel="nofollow noopener noreferrer"
                      target="_blank"
                      href={org.website}
                    >
                      {org.website}
                    </a>
                  </dd>
                </div>
              ) : null}
              {org.addressLine ? (
                <div>
                  <dt className="text-muted">Address</dt>
                  <dd>{org.addressLine}</dd>
                </div>
              ) : null}
              {org.businessHours ? (
                <div>
                  <dt className="text-muted">Business hours</dt>
                  <dd>{org.businessHours}</dd>
                </div>
              ) : null}
              {org.deliveryAreas.length ? (
                <div>
                  <dt className="text-muted">Delivery areas</dt>
                  <dd>{org.deliveryAreas.join(", ")}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
