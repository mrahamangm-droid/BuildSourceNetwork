import Link from "next/link";
import { db } from "@bmn/database";
import { Card, LinkButton } from "@/components/ui";
import { OrgCard, ProductCard, SearchBox } from "@/components/market/parts";
import { categoriesWithCounts, searchProducts } from "@/server/services/products";
import { PLANS } from "@bmn/config";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: 1, t: "Search", d: "Find materials or suppliers." },
  { n: 2, t: "Request", d: "Send one RFQ." },
  { n: 3, t: "Compare", d: "Receive and compare supplier offers." },
  { n: 4, t: "Order", d: "Confirm and track delivery." },
];
const BENEFITS = [
  {
    t: "Compare real offers",
    d: "Price, availability, delivery time and minimum order side by side.",
  },
  {
    t: "One request, several suppliers",
    d: "Get 3 Quotes sends your RFQ to matching suppliers automatically.",
  },
  { t: "Built for the trade", d: "Units like bags, tons, m² and trucks — not a generic shop." },
  {
    t: "Your data stays yours",
    d: "Each company's RFQs, quotes and orders are private to that company.",
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
          <ol className="mt-6 grid gap-4 sm:grid-cols-4">
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
        <h2 className="text-2xl font-bold tracking-tight">Why teams use it</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b) => (
            <Card key={b.t}>
              <p className="font-semibold">{b.t}</p>
              <p className="mt-1 text-sm text-muted">{b.d}</p>
            </Card>
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
