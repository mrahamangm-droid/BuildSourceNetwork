import type { Metadata } from "next";
import { db } from "@bmn/database";
import { Button, EmptyState, Input, Select, Label, LinkButton } from "@/components/ui";
import { Breadcrumbs, Pagination, ProductCard, SearchBox } from "@/components/market/parts";
import { searchProducts, type SearchFilters } from "@/server/services/products";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const hasFilters = Object.keys(sp).some((k) => sp[k]);
  return {
    title: sp.q ? `${sp.q} — building materials` : "Building materials marketplace",
    description:
      "Search building materials by name, SKU, brand, category, supplier or location and compare prices from suppliers.",
    alternates: { canonical: "/marketplace" },
    robots: hasFilters ? { index: false, follow: true } : undefined,
  };
}

const num = (v?: string) =>
  v && !Number.isNaN(Number(v)) && Number(v) >= 0 ? Number(v) : undefined;

async function getFilterOptions() {
  const [categories, brands, suppliers, cities] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    db.brand.findMany({
      where: { products: { some: { isActive: true } } },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
    db.organization.findMany({
      where: { isActive: true, products: { some: { isActive: true } } },
      orderBy: { name: "asc" },
      take: 100,
      select: { slug: true, name: true },
    }),
    db.product.findMany({
      where: { isActive: true, city: { not: null } },
      distinct: ["city"],
      select: { city: true },
      orderBy: { city: "asc" },
    }),
  ]);
  return { categories, brands, suppliers, cities: cities.map((c) => c.city!).filter(Boolean) };
}

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filters: SearchFilters = {
    q: sp.q?.trim() || undefined,
    category: sp.category || undefined,
    brand: sp.brand || undefined,
    supplier: sp.supplier || undefined,
    city: sp.city || undefined,
    verifiedOnly: sp.verified === "1",
    inStockOnly: sp.stock === "1",
    deliveryOnly: sp.delivery === "1",
    minPrice: num(sp.minPrice),
    maxPrice: num(sp.maxPrice),
    maxMoq: num(sp.maxMoq),
    sort: (["price_asc", "price_desc", "newest"].includes(sp.sort ?? "")
      ? sp.sort
      : "relevance") as SearchFilters["sort"],
    page: Number(sp.page) || 1,
  };
  const [result, opts] = await Promise.all([searchProducts(filters), getFilterOptions()]);
  const rfqHref = `/request-quotes?${new URLSearchParams({ ...(sp.q ? { material: sp.q } : {}), ...(sp.city ? { city: sp.city } : {}), ...(sp.category ? { category: sp.category } : {}) }).toString()}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Marketplace" }]} />
      <h1 className="mb-4 text-3xl font-bold tracking-tight">Building materials marketplace</h1>
      <SearchBox defaultValue={sp.q} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <form
          method="get"
          className="space-y-3 rounded-xl border border-line p-4 text-sm lg:sticky lg:top-24 lg:self-start"
        >
          {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
          <div>
            <Label htmlFor="category">Category</Label>
            <Select id="category" name="category" defaultValue={sp.category ?? ""}>
              <option value="">All categories</option>
              {opts.categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="city">Location</Label>
            <Select id="city" name="city" defaultValue={sp.city ?? ""}>
              <option value="">Anywhere</option>
              {opts.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="brand">Brand</Label>
            <Select id="brand" name="brand" defaultValue={sp.brand ?? ""}>
              <option value="">All brands</option>
              {opts.brands.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="supplier">Supplier</Label>
            <Select id="supplier" name="supplier" defaultValue={sp.supplier ?? ""}>
              <option value="">All suppliers</option>
              {opts.suppliers.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="minPrice">Min price</Label>
              <Input
                id="minPrice"
                name="minPrice"
                type="number"
                min="0"
                step="any"
                defaultValue={sp.minPrice}
              />
            </div>
            <div>
              <Label htmlFor="maxPrice">Max price</Label>
              <Input
                id="maxPrice"
                name="maxPrice"
                type="number"
                min="0"
                step="any"
                defaultValue={sp.maxPrice}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="maxMoq">Max minimum order</Label>
            <Input
              id="maxMoq"
              name="maxMoq"
              type="number"
              min="0"
              step="any"
              defaultValue={sp.maxMoq}
            />
          </div>
          <div>
            <Label htmlFor="sort">Sort by</Label>
            <Select id="sort" name="sort" defaultValue={sp.sort ?? "relevance"}>
              <option value="relevance">Relevance</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="newest">Newest</option>
            </Select>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="verified" value="1" defaultChecked={sp.verified === "1"} />{" "}
            Verified suppliers only
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="stock" value="1" defaultChecked={sp.stock === "1"} /> In
            stock
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="delivery" value="1" defaultChecked={sp.delivery === "1"} />{" "}
            Delivery available
          </label>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Apply
            </Button>
            <LinkButton href="/marketplace" variant="outline">
              Reset
            </LinkButton>
          </div>
        </form>

        <section aria-live="polite">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              {result.total} product{result.total === 1 ? "" : "s"} found
            </p>
            <LinkButton href={rfqHref} size="sm">
              Get 3 Quotes
            </LinkButton>
          </div>
          {result.items.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No products match your search"
              body="Try fewer filters — or let suppliers come to you."
              action={<LinkButton href={rfqHref}>Request quotes instead</LinkButton>}
            />
          )}
          <Pagination page={result.page} pages={result.pages} params={sp} basePath="/marketplace" />
        </section>
      </div>
    </div>
  );
}
