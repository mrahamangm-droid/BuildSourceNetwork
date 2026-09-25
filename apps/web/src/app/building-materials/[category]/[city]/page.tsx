import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@bmn/database";
import { Breadcrumbs, Pagination, ProductCard } from "@/components/market/parts";
import { LinkButton } from "@/components/ui";
import { searchProducts } from "@/server/services/products";
import { slugify } from "@bmn/config";

export const dynamic = "force-dynamic";

async function load(categorySlug: string, citySlug: string, page: number) {
  const category = await db.category.findUnique({ where: { slug: categorySlug } });
  if (!category) return null;
  const cityRows = await db.product.findMany({
    where: { isActive: true, categoryId: category.id, city: { not: null } },
    distinct: ["city"],
    select: { city: true },
  });
  const city = cityRows.map((c) => c.city!).find((c) => slugify(c) === citySlug);
  if (!city) return null;
  const result = await searchProducts({ category: categorySlug, city, page });
  return result.total ? { category, city, result } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; city: string }>;
}): Promise<Metadata> {
  const p = await params;
  const d = await load(p.category, p.city, 1);
  if (!d) return { title: "Not found", robots: { index: false } };
  return {
    title: `${d.category.name} in ${d.city} — suppliers and prices`,
    description: `Find ${d.category.name.toLowerCase()} suppliers in ${d.city}. Compare prices and request quotes.`,
    alternates: { canonical: `/building-materials/${d.category.slug}/${p.city}` },
  };
}

export default async function CategoryCityPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; city: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const p = await params;
  const d = await load(p.category, p.city, Number((await searchParams).page) || 1);
  if (!d) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Building materials", href: "/building-materials" },
          { name: d.category.name, href: `/building-materials/${d.category.slug}` },
          { name: d.city },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          {d.category.name} in {d.city}
        </h1>
        <LinkButton
          href={`/request-quotes?category=${d.category.slug}&city=${encodeURIComponent(d.city)}`}
        >
          Get 3 Quotes
        </LinkButton>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {d.result.items.map((x) => (
          <ProductCard key={x.id} p={x} />
        ))}
      </div>
      <Pagination
        page={d.result.page}
        pages={d.result.pages}
        params={{}}
        basePath={`/building-materials/${d.category.slug}/${p.city}`}
      />
    </div>
  );
}
