import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, LinkButton } from "@/components/ui";
import {
  Breadcrumbs,
  DemoBadge,
  JsonLd,
  StockBadge,
  VerifiedBadge,
} from "@/components/market/parts";
import { alternativesFor, getPublicProduct } from "@/server/services/products";
import { SupplyChain } from "@/components/market/supply-chain";
import { Alternatives } from "@/components/market/alternatives";
import { appUrl, formatMoney, formatQty } from "@/lib/utils";
import { savingsPercent } from "@/lib/pricing";
import { getCtx } from "@/server/access";
import { ProductReviews } from "@/components/market/product-reviews";
import { AddToCart } from "@/components/market/add-to-cart";
import { BUYER_TYPES } from "@bmn/config";
import { RatingLine } from "@/components/market/stars";
import type { ReviewSort } from "@/server/services/reviews";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const p = await getPublicProduct((await params).id);
  if (!p) return { title: "Product not found", robots: { index: false } };
  const title = `${p.name} — ${p.org.name}`;
  const description = `${p.name} from ${p.org.name}${p.city ? ` in ${p.city}` : ""}. ${formatMoney(p.price.toString(), p.currency)} per ${p.unit.name.toLowerCase()}, minimum order ${formatQty(p.minOrderQty)}.`;
  return {
    title,
    description,
    alternates: { canonical: `/products/${p.id}` },
    openGraph: { title, description, images: p.images[0] ? [p.images[0].url] : undefined },
  };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rsort?: string; rpage?: string }>;
}) {
  const sp = await searchParams;
  const rsort = (
    ["newest", "highest", "lowest"].includes(sp.rsort ?? "") ? sp.rsort : "helpful"
  ) as ReviewSort;
  const p = await getPublicProduct((await params).id);
  if (!p) notFound();
  const specs = (p.specifications ?? {}) as Record<string, string>;
  const [alternatives, ctx] = await Promise.all([alternativesFor(p.id), getCtx()]);
  const base = p.org.type === "STORE" ? "stores" : "suppliers";
  const availability =
    p.stockStatus === "OUT_OF_STOCK"
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.name,
          sku: p.sku ?? undefined,
          description: p.description ?? undefined,
          brand: p.brand ? { "@type": "Brand", name: p.brand.name } : undefined,
          manufacturer: p.manufacturer
            ? { "@type": "Organization", name: p.manufacturer.name }
            : undefined,
          material: p.material ?? undefined,
          color: p.color ?? undefined,
          image: p.images.map((i) => i.url),
          aggregateRating:
            p.ratingCount > 0 && p.ratingAvg != null
              ? {
                  "@type": "AggregateRating",
                  ratingValue: Number(p.ratingAvg.toString()),
                  reviewCount: p.ratingCount,
                }
              : undefined,
          offers: {
            "@type": "Offer",
            price: p.price.toString(),
            priceCurrency: p.currency,
            availability,
            url: `${appUrl()}/products/${p.id}`,
            seller: { "@type": "Organization", name: p.org.name },
          },
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Marketplace", href: "/marketplace" },
          { name: p.category.name, href: `/building-materials/${p.category.slug}` },
          { name: p.name },
        ]}
      />
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl border border-line bg-surface">
            {p.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.images[0].url}
                alt={p.images[0].alt ?? p.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-muted">No image</div>
            )}
          </div>
          {p.images.length > 1 ? (
            <ul className="mt-2 flex gap-2 overflow-x-auto">
              {p.images.slice(1).map((im) => (
                <li
                  key={im.id}
                  className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line"
                >
                  <a href={im.url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={im.url}
                      alt={im.alt ?? p.name}
                      className="h-full w-full object-cover"
                    />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <div className="flex flex-wrap gap-1">
            <StockBadge status={p.stockStatus} />
            <DemoBadge show={p.isDemo} />
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{p.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {p.brand ? `${p.brand.name} · ` : ""}
            {p.category.name}
            {p.sku ? ` · SKU ${p.sku}` : ""}
          </p>
          <a href="#reviews" className="mt-1 block">
            <RatingLine
              avg={p.ratingAvg == null ? null : Number(p.ratingAvg.toString())}
              count={p.ratingCount}
            />
          </a>
          <p className="mt-4 text-3xl font-bold">
            {formatMoney(p.price.toString(), p.currency)}{" "}
            <span className="text-base font-normal text-muted">
              / {p.unit.name.toLowerCase()} (+{Number(p.vatRatePercent)}% VAT)
            </span>
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Minimum order</dt>
              <dd className="font-medium">
                {formatQty(p.minOrderQty)} {p.unit.name.toLowerCase()}
              </dd>
            </div>
            {p.packageSize ? (
              <div>
                <dt className="text-muted">Package</dt>
                <dd className="font-medium">{p.packageSize}</dd>
              </div>
            ) : null}
            {(
              [
                ["Manufacturer", p.manufacturer?.name],
                ["Material", p.material],
                ["Grade / class", p.grade],
                ["Size", p.size],
                ["Dimensions", p.dimensions],
                ["Colour", p.color],
                ["Finish", p.finish],
                ["Application", p.application],
                ["Country of origin", p.countryOfOrigin],
              ] as const
            )
              .filter(([, v]) => !!v)
              .map(([label, v]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            <div>
              <dt className="text-muted">Location</dt>
              <dd className="font-medium">{p.city ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Delivery</dt>
              <dd className="font-medium">{p.deliveryAvailable ? "Available" : "Pick-up only"}</dd>
            </div>
          </dl>
          {p.priceBreaks.length ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-line text-sm">
              <table className="w-full text-left">
                <caption className="bg-surface px-3 py-2 text-left text-xs font-semibold uppercase text-muted">
                  Volume pricing
                </caption>
                <tbody className="divide-y divide-line">
                  <tr>
                    <td className="px-3 py-2">
                      {formatQty(p.minOrderQty)}+ {p.unit.name.toLowerCase()}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {formatMoney(p.price.toString(), p.currency)}
                    </td>
                    <td className="px-3 py-2 text-muted" />
                  </tr>
                  {p.priceBreaks.map((b) => (
                    <tr key={b.id}>
                      <td className="px-3 py-2">
                        {formatQty(b.minQty)}+ {p.unit.name.toLowerCase()}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {formatMoney(b.price.toString(), p.currency)}
                      </td>
                      <td className="px-3 py-2 text-green-700">
                        Save {savingsPercent(Number(p.price), Number(b.price))}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {ctx && BUYER_TYPES.includes(ctx.orgType) && ctx.orgId !== p.orgId ? (
            <AddToCart
              productId={p.id}
              minQty={Number(p.minOrderQty)}
              unit={p.unit.name.toLowerCase()}
              disabled={p.stockStatus === "OUT_OF_STOCK"}
            />
          ) : !ctx ? (
            <p className="mt-4 text-sm text-muted">
              <Link className="text-brand-700 hover:underline" href="/login">
                Sign in
              </Link>{" "}
              as a buyer to add this to your cart or save it to a list.
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <LinkButton href={`/request-quotes?productId=${p.id}`} size="lg">
              Get 3 Quotes
            </LinkButton>
            <LinkButton
              href={`/request-quotes?productId=${p.id}&supplier=${p.org.id}&mode=custom`}
              variant="outline"
              size="lg"
            >
              Ask {p.org.name}
            </LinkButton>
          </div>
          <Card className="mt-6">
            <p className="text-sm text-muted">Sold by</p>
            <Link href={`/${base}/${p.org.slug}`} className="font-semibold hover:text-brand-700">
              {p.org.name}
            </Link>
            <div className="mt-1 flex gap-1">
              <VerifiedBadge status={p.org.verificationStatus} />
              <DemoBadge show={p.org.isDemo} />
            </div>
            <div className="mt-3 border-t border-line pt-3">
              <SupplyChain org={p.org} />
            </div>
          </Card>
        </div>
      </div>
      {p.description ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Description</h2>
          <p className="mt-2 whitespace-pre-line text-slate-700">{p.description}</p>
        </section>
      ) : null}
      {Object.keys(specs).length ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Specifications</h2>
          <dl className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
            {Object.entries(specs).map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-2 px-4 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="col-span-2">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {p.documents.length ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Documents</h2>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
            {p.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-700 hover:underline"
                >
                  {d.name}
                </a>
                <span className="text-xs text-muted">
                  {d.kind === "MSDS"
                    ? "Safety data sheet"
                    : d.kind === "CERTIFICATE"
                      ? "Certificate"
                      : d.kind === "DATASHEET"
                        ? "Datasheet"
                        : "Document"}{" "}
                  · PDF
                  {d.sizeBytes ? ` · ${Math.max(1, Math.round(d.sizeBytes / 1024))} KB` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ProductReviews
        product={{
          id: p.id,
          orgId: p.orgId,
          brandId: p.brandId,
          manufacturerId: p.manufacturerId,
        }}
        ctx={ctx}
        sort={rsort}
        page={Math.max(1, Number(sp.rpage) || 1)}
        basePath={`/products/${p.id}`}
      />
      <Alternatives
        items={alternatives}
        note={
          p.stockStatus === "OUT_OF_STOCK"
            ? "This item is out of stock. These comparable products are available now."
            : undefined
        }
      />
      <p className="mt-6 text-sm text-muted">
        Need something different?{" "}
        <Link
          className="text-brand-700 hover:underline"
          href={`/match?q=${encodeURIComponent(p.name)}${p.city ? `&city=${encodeURIComponent(p.city)}` : ""}`}
        >
          Try smart matching
        </Link>
        .
      </p>
    </div>
  );
}
