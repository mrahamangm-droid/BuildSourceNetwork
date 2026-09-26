import type { Metadata } from "next";
import Link from "next/link";
import { db, type Prisma } from "@bmn/database";
import { Button, EmptyState, Input, Select, Label, LinkButton } from "@/components/ui";
import { Breadcrumbs, Pagination, ProductCard, SearchBox } from "@/components/market/parts";
import { CategoryFilterSelect } from "@/components/market/category-filter-select";
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

/** Structured product attributes offered as filters (only when at least one product has a value). */
const ATTRIBUTE_FILTERS = [
  { key: "material", param: "material", label: "Material" },
  { key: "grade", param: "grade", label: "Grade / class" },
  { key: "color", param: "color", label: "Colour" },
  { key: "finish", param: "finish", label: "Finish" },
  { key: "application", param: "application", label: "Application" },
] as const;

/** Distinct values of one attribute across active products, for filter dropdowns. */
async function distinctValues(
  key: "material" | "grade" | "color" | "finish" | "application",
): Promise<string[]> {
  const rows = await db.product.findMany({
    where: { isActive: true, [key]: { not: null } } as Prisma.ProductWhereInput,
    distinct: [key],
    select: { [key]: true } as Prisma.ProductSelect,
    orderBy: { [key]: "asc" } as Prisma.ProductOrderByWithRelationInput,
    take: 100,
  });
  return rows.map((r) => (r as Record<string, string | null>)[key]).filter((v): v is string => !!v);
}

const num = (v?: string) =>
  v && !Number.isNaN(Number(v)) && Number(v) >= 0 ? Number(v) : undefined;

async function getFilterOptions(categorySlug?: string, subcategorySlug?: string) {
  const [categories, subcategories, types, brands, suppliers, cities, manufacturers, ...attrs] =
    await Promise.all([
      db.category.findMany({
        orderBy: { sortOrder: "asc" },
        select: { slug: true, name: true, department: { select: { name: true } } },
      }),
      categorySlug
        ? db.subcategory.findMany({
            where: { category: { slug: categorySlug } },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { slug: true, name: true },
          })
        : Promise.resolve([]),
      categorySlug && subcategorySlug
        ? db.productType.findMany({
            where: { subcategory: { slug: subcategorySlug, category: { slug: categorySlug } } },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { slug: true, name: true },
          })
        : Promise.resolve([]),
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
      db.manufacturer.findMany({
        where: { products: { some: { isActive: true } } },
        orderBy: { name: "asc" },
        select: { slug: true, name: true },
      }),
      distinctValues("material"),
      distinctValues("grade"),
      distinctValues("color"),
      distinctValues("finish"),
      distinctValues("application"),
    ]);
  const groups = new Map<string, { slug: string; name: string }[]>();
  for (const c of categories) {
    const key = c.department?.name ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), { slug: c.slug, name: c.name }]);
  }
  return {
    categoryGroups: [...groups].map(([department, items]) => ({ department, items })),
    subcategories,
    types,
    brands,
    suppliers,
    cities: cities.map((c) => c.city!).filter(Boolean),
    manufacturers,
    attributes: ATTRIBUTE_FILTERS.map((f, i) => ({ ...f, values: attrs[i] })).filter(
      (f) => f.values.length,
    ),
  };
}

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filters: SearchFilters = {
    q: sp.q?.trim() || undefined,
    category: sp.category || undefined,
    subcategory: sp.category ? sp.sub || undefined : undefined,
    productType: sp.category && sp.sub ? sp.type || undefined : undefined,
    brand: sp.brand || undefined,
    manufacturer: sp.manufacturer || undefined,
    material: sp.material || undefined,
    grade: sp.grade || undefined,
    color: sp.color || undefined,
    finish: sp.finish || undefined,
    application: sp.application || undefined,
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
  const [result, opts] = await Promise.all([
    searchProducts(filters),
    getFilterOptions(sp.category, sp.sub),
  ]);
  const rfqHref = `/request-quotes?${new URLSearchParams({ ...(sp.q ? { material: sp.q } : {}), ...(sp.city ? { city: sp.city } : {}), ...(sp.category ? { category: sp.category } : {}) }).toString()}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Marketplace" }]} />
      <h1 className="mb-4 text-3xl font-bold tracking-tight">Building materials marketplace</h1>
      <SearchBox defaultValue={sp.q} />
      <p className="mt-2 text-sm">
        <Link className="text-brand-700 hover:underline" href="/categories">
          Browse all departments and categories →
        </Link>
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <form
          method="get"
          className="space-y-3 rounded-xl border border-line p-4 text-sm lg:sticky lg:top-24 lg:self-start"
        >
          {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
          <div>
            <Label htmlFor="category">Category</Label>
            <CategoryFilterSelect groups={opts.categoryGroups} defaultValue={sp.category ?? ""} />
          </div>
          {sp.category && opts.subcategories.length ? (
            <div>
              <Label htmlFor="sub">Subcategory</Label>
              <Select id="sub" name="sub" defaultValue={sp.sub ?? ""}>
                <option value="">All subcategories</option>
                {opts.subcategories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {sp.category && sp.sub && opts.types.length ? (
            <div>
              <Label htmlFor="type">Product type</Label>
              <Select id="type" name="type" defaultValue={sp.type ?? ""}>
                <option value="">All product types</option>
                {opts.types.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
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
          {opts.manufacturers.length ? (
            <div>
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Select id="manufacturer" name="manufacturer" defaultValue={sp.manufacturer ?? ""}>
                <option value="">All manufacturers</option>
                {opts.manufacturers.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {opts.attributes.length ? (
            <details className="space-y-3" open={opts.attributes.some((a) => !!sp[a.param])}>
              <summary className="cursor-pointer font-medium">Material, colour and more</summary>
              {opts.attributes.map((a) => (
                <div key={a.key} className="mt-3">
                  <Label htmlFor={a.param}>{a.label}</Label>
                  <Select id={a.param} name={a.param} defaultValue={sp[a.param] ?? ""}>
                    <option value="">Any</option>
                    {a.values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </details>
          ) : null}
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
