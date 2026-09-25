import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@bmn/database";
import { Breadcrumbs, JsonLd, OrgCard, Pagination, ProductCard } from "@/components/market/parts";
import { LinkButton } from "@/components/ui";
import { searchProducts } from "@/server/services/products";
import { slugify } from "@bmn/config";
import { appUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function load(slug: string, page: number) {
  const category = await db.category.findUnique({ where: { slug } });
  if (!category) return null;
  const [result, cities, suppliers] = await Promise.all([
    searchProducts({ category: slug, page }),
    db.product.findMany({
      where: { isActive: true, categoryId: category.id, city: { not: null } },
      distinct: ["city"],
      select: { city: true },
      orderBy: { city: "asc" },
    }),
    db.organization.findMany({
      where: {
        isActive: true,
        type: "SUPPLIER",
        products: { some: { isActive: true, categoryId: category.id } },
      },
      take: 6,
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
      },
    }),
  ]);
  if (result.total === 0) return null; // only real, populated pages are indexable
  return { category, result, cities: cities.map((c) => c.city!), suppliers };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const d = await load((await params).category, 1);
  if (!d) return { title: "Not found", robots: { index: false } };
  return {
    title: `${d.category.name} suppliers and prices`,
    description: `Compare ${d.category.name.toLowerCase()} prices from ${d.result.total} listing${d.result.total === 1 ? "" : "s"} and request quotes from suppliers.`,
    alternates: { canonical: `/building-materials/${d.category.slug}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { category } = await params;
  const sp = await searchParams;
  const d = await load(category, Number(sp.page) || 1);
  if (!d) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Building materials",
              item: `${appUrl()}/building-materials`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: d.category.name,
              item: `${appUrl()}/building-materials/${d.category.slug}`,
            },
          ],
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Building materials", href: "/building-materials" },
          { name: d.category.name },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{d.category.name}</h1>
        <LinkButton href={`/request-quotes?category=${d.category.slug}`}>Get 3 Quotes</LinkButton>
      </div>
      {d.cities.length ? (
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="text-muted">Locations:</span>
          {d.cities.map((c) => (
            <Link
              key={c}
              className="text-brand-700 hover:underline"
              href={`/building-materials/${d.category.slug}/${slugify(c)}`}
            >
              {c}
            </Link>
          ))}
        </p>
      ) : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {d.result.items.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
      <Pagination
        page={d.result.page}
        pages={d.result.pages}
        params={{}}
        basePath={`/building-materials/${d.category.slug}`}
      />
      {d.suppliers.length ? (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">
            Suppliers of {d.category.name.toLowerCase()}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.suppliers.map((o) => (
              <OrgCard key={o.id} o={o} basePath="suppliers" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
