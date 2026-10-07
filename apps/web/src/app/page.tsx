import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@bmn/database";
import { Card, LinkButton } from "@/components/ui";
import { OrgCard, ProductCard, SearchBox } from "@/components/market/parts";
import { categoriesWithCounts, searchProducts } from "@/server/services/products";
import { PLANS } from "@bmn/config";
import { JsonLd } from "@/components/market/parts";
import { BRAND, COMPANY } from "@/lib/company";
import { HomePicture } from "@/components/market/home-picture";
import { LocationExplorer, type LocationItem } from "@/components/market/location-explorer";
import { appUrl, countryName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} — construction materials, suppliers and quotes` },
  description:
    "Find building-materials suppliers, compare prices, request quotes from several suppliers at once and manage procurement from RFQ to delivery.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} — construction materials, suppliers and quotes`,
    description:
      "Compare building-materials suppliers, request quotes and track delivery in one place.",
    url: "/",
  },
};

const MATERIAL_TILES = [
  {
    key: "concrete-blocks-stacked",
    label: "Blocks & pavers",
    href: "/building-materials/blocks",
  },
  { key: "steel-rebar-coils", label: "Steel & rebar", href: "/building-materials/steel" },
  { key: "timber-planks-stack", label: "Timber & joinery", href: "/marketplace?q=timber" },
  {
    key: "aggregate-dump-truck-delivery",
    label: "Aggregates & delivery",
    href: "/building-materials/gravel",
  },
  { key: "clay-bricks-masonry", label: "Bricks & masonry", href: "/marketplace?q=brick" },
] as const;

const AUDIENCES = [
  {
    key: "supplier-warehouse-racking",
    t: "Suppliers & shops",
    d: "List your stock and prices, receive RFQs from verified buyers and answer them in one place.",
    href: "/register?type=SUPPLIER",
    cta: "Join as supplier",
  },
  {
    key: "contractors-site-walkthrough",
    t: "Contractors",
    d: "Turn a BOQ into RFQs, compare quotes line by line and track every delivery to site.",
    href: "/register?type=CONTRACTOR",
    cta: "Join as contractor",
  },
  {
    key: "builders-reviewing-plans",
    t: "Developers & consultants",
    d: "Standardise procurement across projects with side-by-side offers and a clear audit trail.",
    href: "/request-quotes",
    cta: "Request quotes",
  },
  {
    key: "modern-villa-pool",
    t: "Home builders & owners",
    d: "Describe what you are building and let smart matching shortlist suppliers near you.",
    href: "/match",
    cta: "Try smart match",
  },
] as const;

const STEPS = [
  { n: 1, t: "Find", d: "Search materials or let smart matching shortlist suppliers." },
  { n: 2, t: "Compare", d: "Price, stock, location, delivery and verification side by side." },
  { n: 3, t: "Request", d: "Send one RFQ to several suppliers at once." },
  { n: 4, t: "Choose", d: "Pick the best quote, with alternatives if an item is short." },
  { n: 5, t: "Order", d: "Confirm the order in one click from the winning quote." },
  { n: 6, t: "Deliver", d: "Track delivery until the materials are on site." },
];
const BENEFITS = [
  {
    t: "Smart material matching",
    d: "Describe what you need and get ranked products and suppliers, with the reasons shown.",
    href: "/match",
  },
  {
    t: "One RFQ, several quotes",
    d: "Get 3 Quotes sends your request to matching suppliers and lines the answers up for you.",
    href: "/request-quotes",
  },
  {
    t: "Smart alternatives",
    d: "Out of stock or too far? See comparable products from other suppliers instantly.",
    href: "/marketplace",
  },
  {
    t: "Project workspace",
    d: "Take a BOQ through RFQs, quotes, orders and delivery inside one project.",
    href: "/register?type=CONTRACTOR",
  },
  {
    t: "Verified supply chain",
    d: "See whether you are buying from a manufacturer, distributor or wholesaler, and who is verified.",
    href: "/suppliers",
  },
  {
    t: "Built for the trade",
    d: "Units like bags, tons, m² and trucks. Each company's RFQs, quotes and orders stay private.",
    href: "/pricing",
  },
];

export default async function HomePage() {
  const [cats, popular, verified, cityRows] = await Promise.all([
    categoriesWithCounts(),
    searchProducts({ pageSize: 4, sort: "newest" }),
    db.organization.findMany({
      where: { type: "SUPPLIER", isActive: true, products: { some: { isActive: true } } },
      orderBy: [{ verificationStatus: "asc" }, { name: "asc" }],
      take: 3,
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        description: true,
        logoUrl: true,
        verificationStatus: true,
        isDemo: true,
        categories: { select: { name: true } },
        _count: { select: { products: { where: { isActive: true } } } },
      },
    }),
    db.organization.groupBy({
      by: ["city", "country", "type"],
      where: { type: { in: ["SUPPLIER", "STORE"] }, isActive: true, city: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const cityMap = new Map<string, LocationItem>();
  for (const r of cityRows) {
    if (!r.city) continue;
    const key = `${r.city}|${r.country}`;
    const item = cityMap.get(key) ?? {
      query: `${r.city}, ${countryName(r.country)}`,
      city: r.city,
      suppliers: 0,
      shops: 0,
    };
    if (r.type === "SUPPLIER") item.suppliers += r._count._all;
    else item.shops += r._count._all;
    cityMap.set(key, item);
  }
  const locations = [...cityMap.values()]
    .sort((a, b) => b.suppliers + b.shops - (a.suppliers + a.shops) || a.city.localeCompare(b.city))
    .slice(0, 8);
  const anyVerified = verified.some((v) => v.verificationStatus === "VERIFIED");
  const popularCats = cats
    .filter((c) => c._count.products > 0)
    .sort((a, b) => b._count.products - a._count.products)
    .slice(0, 8);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: BRAND.name,
          legalName: COMPANY.legalName,
          url: appUrl(),
          logo: `${appUrl()}/brand/bsn-mark-1024.png`,
          email: COMPANY.supportEmail,
          address: { "@type": "PostalAddress", addressLocality: "RAK", addressCountry: "AE" },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: BRAND.name,
          url: appUrl(),
          potentialAction: {
            "@type": "SearchAction",
            target: `${appUrl()}/marketplace?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <section className="border-b border-line bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14 lg:py-20">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Building Materials. One Platform.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600">
              Find suppliers, compare offers, request quotes and manage construction-material
              procurement in one place.
            </p>
            <div className="mt-8 max-w-xl">
              <SearchBox large />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href="/marketplace" size="lg">
                Find Materials
              </LinkButton>
              <LinkButton href="/request-quotes" size="lg" variant="dark">
                Request Quotes
              </LinkButton>
              <LinkButton href="/match" size="lg" variant="outline">
                Smart Match
              </LinkButton>
            </div>
            <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <Link className="text-brand-700 hover:underline" href="/register?type=SUPPLIER">
                Join as Supplier
              </Link>
              <Link className="text-brand-700 hover:underline" href="/register?type=STORE">
                Join as Store
              </Link>
              <Link className="text-brand-700 hover:underline" href="/register?type=CONTRACTOR">
                Join as Contractor
              </Link>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="col-span-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
              <HomePicture
                name="hero-dubai-skyline-construction"
                priority
                sizes="(min-width: 1024px) 520px, (min-width: 640px) 90vw, 92vw"
              />
            </div>
            <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-sm sm:block">
              <HomePicture
                name="hero-contractor-supplier-handshake"
                sizes="(min-width: 1024px) 252px, 44vw"
              />
            </div>
            <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-sm sm:block">
              <HomePicture
                name="hero-modern-home-architecture"
                sizes="(min-width: 1024px) 252px, 44vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="shop-by-material">
        <div className="flex items-end justify-between">
          <h2 id="shop-by-material" className="text-2xl font-bold tracking-tight">
            Shop by material
          </h2>
          <Link className="text-sm text-brand-700 hover:underline" href="/marketplace">
            Browse everything
          </Link>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {MATERIAL_TILES.map((m) => (
            <li key={m.key}>
              <Link
                href={m.href}
                className="group relative block overflow-hidden rounded-xl border border-line bg-surface"
              >
                <HomePicture
                  name={m.key}
                  sizes="(min-width: 1024px) 190px, (min-width: 640px) 30vw, 46vw"
                  className="transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-8 text-sm font-semibold text-white">
                  {m.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {popularCats.length ? (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-bold tracking-tight">Popular categories</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {popularCats.map((c) => (
              <Link key={c.id} href={`/building-materials/${c.slug}`}>
                <Card className="hover:border-brand-600">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted">{c._count.products} listings</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {popular.items.length ? (
        <section className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Popular materials</h2>
            <Link className="text-sm text-brand-700 hover:underline" href="/marketplace">
              View all
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popular.items.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      ) : null}

      {verified.length ? (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold tracking-tight">
              {anyVerified ? "Verified suppliers" : "Featured suppliers"}
            </h2>
            <Link className="text-sm text-brand-700 hover:underline" href="/suppliers">
              All suppliers
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {verified.map((o) => (
              <OrgCard key={o.id} o={o} basePath="suppliers" />
            ))}
          </div>
        </section>
      ) : null}

      {locations.length ? (
        <section className="mx-auto max-w-6xl px-4 py-12" aria-labelledby="where-we-supply">
          <h2 id="where-we-supply" className="text-2xl font-bold tracking-tight">
            Suppliers and shops near your site
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Pick a city to see where listed suppliers and shops operate. Some listings are labelled
            demo profiles.
          </p>
          <div className="mt-5">
            <LocationExplorer items={locations} />
          </div>
        </section>
      ) : null}

      <section className="bg-surface py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-xl border border-line bg-white p-5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {s.n}
                </span>
                <p className="mt-3 font-semibold">{s.t}</p>
                <p className="text-sm text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-14" aria-labelledby="built-for">
        <h2 id="built-for" className="text-2xl font-bold tracking-tight">
          Built for every side of the build
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((a) => (
            <Card key={a.t} className="flex h-full flex-col overflow-hidden p-0">
              <HomePicture
                name={a.key}
                sizes="(min-width: 1024px) 280px, (min-width: 640px) 44vw, 92vw"
              />
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-semibold">{a.t}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{a.d}</p>
                <Link
                  className="mt-3 text-sm font-semibold text-brand-700 hover:underline"
                  href={a.href}
                >
                  {a.cta}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold tracking-tight">Built to save procurement time</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <Link key={b.t} href={b.href}>
              <Card className="h-full hover:border-brand-600">
                <p className="font-semibold">{b.t}</p>
                <p className="mt-1 text-sm text-muted">{b.d}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <h2 className="text-2xl font-bold tracking-tight">Simple pricing</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.slice(0, 4).map((p) => (
            <Card key={p.code}>
              <p className="font-semibold">{p.name}</p>
              <p className="mt-1 text-2xl font-bold">
                {p.priceMonthlyCents ? `$${(p.priceMonthlyCents ?? 0) / 100}` : "Free"}
                {p.priceMonthlyCents ? (
                  <span className="text-sm font-normal text-muted">/mo</span>
                ) : null}
              </p>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-sm">
          <Link className="text-brand-700 hover:underline" href="/pricing">
            See plan details
          </Link>
        </p>
      </section>

      <section className="bg-ink py-14 text-center text-white">
        <h2 className="mx-auto max-w-3xl px-4 text-3xl font-bold tracking-tight">
          I need building materials. I need prices. I need quotes.
        </h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3 px-4">
          <LinkButton href="/register" size="lg">
            Create free account
          </LinkButton>
          <LinkButton href="/marketplace" size="lg" variant="outline">
            Browse marketplace
          </LinkButton>
        </div>
      </section>
    </>
  );
}
