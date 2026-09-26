import Link from "next/link";
import { db } from "@bmn/database";
import { Card, LinkButton } from "@/components/ui";
import { OrgCard, ProductCard, SearchBox } from "@/components/market/parts";
import { categoriesWithCounts, searchProducts } from "@/server/services/products";
import { PLANS } from "@bmn/config";
import { JsonLd } from "@/components/market/parts";
import { BRAND, COMPANY } from "@/lib/company";
import { appUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
  const [cats, popular, verified] = await Promise.all([
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
  ]);
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
      <section className="border-b border-line bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Building Materials. One Platform.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Find suppliers, compare offers, request quotes and manage construction-material
            procurement in one place.
          </p>
          <div className="mx-auto mt-8 max-w-2xl">
            <SearchBox large />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
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
          <p className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
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
        <h2 className="text-3xl font-bold tracking-tight">
          I need building materials. I need prices. I need quotes.
        </h2>
        <div className="mt-6 flex justify-center gap-3">
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
