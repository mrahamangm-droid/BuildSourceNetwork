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
import { getPublicProduct } from "@/server/services/products";
import { appUrl, formatMoney, formatQty } from "@/lib/utils";

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

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await getPublicProduct((await params).id);
  if (!p) notFound();
  const specs = (p.specifications ?? {}) as Record<string, string>;
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
          image: p.images.map((i) => i.url),
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
            <div>
              <dt className="text-muted">Location</dt>
              <dd className="font-medium">{p.city ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Delivery</dt>
              <dd className="font-medium">{p.deliveryAvailable ? "Available" : "Pick-up only"}</dd>
            </div>
          </dl>
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
    </div>
  );
}
