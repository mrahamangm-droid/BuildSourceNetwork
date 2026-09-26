import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { formatMoney, formatQty } from "@/lib/utils";
import { DEMO_LABEL, SUPPLIER_KIND_LABEL, type SupplierKind } from "@bmn/config";

export function VerifiedBadge({ status }: { status: string }) {
  return status === "VERIFIED" ? <Badge tone="green">Verified business</Badge> : null;
}
export function DemoBadge({ show }: { show: boolean }) {
  return show ? (
    <Badge tone="amber" title={DEMO_LABEL}>
      Demo
    </Badge>
  ) : null;
}

const STOCK: Record<string, { label: string; tone: "green" | "amber" | "red" | "blue" }> = {
  IN_STOCK: { label: "In stock", tone: "green" },
  LOW_STOCK: { label: "Low stock", tone: "amber" },
  OUT_OF_STOCK: { label: "Out of stock", tone: "red" },
  ON_REQUEST: { label: "On request", tone: "blue" },
};
export function StockBadge({ status }: { status: string }) {
  const s = STOCK[status] ?? STOCK.ON_REQUEST;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export type ProductCardData = {
  id: string;
  name: string;
  price: { toString(): string };
  currency: string;
  minOrderQty: { toString(): string };
  stockStatus: string;
  city: string | null;
  deliveryAvailable: boolean;
  isDemo: boolean;
  packageSize: string | null;
  unit: { name: string };
  category: { name: string };
  brand: { name: string } | null;
  org: { name: string; slug: string; type: string; verificationStatus: string };
  images: { url: string; alt: string | null }[];
};

export function ProductCard({ p }: { p: ProductCardData }) {
  const img = p.images[0];
  return (
    <Card className="flex flex-col p-0 overflow-hidden">
      <Link href={`/products/${p.id}`} className="block aspect-[4/3] bg-surface">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.url}
            alt={img.alt ?? p.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-xs text-muted">{p.category.name}</div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1">
          <StockBadge status={p.stockStatus} />
          <DemoBadge show={p.isDemo} />
        </div>
        <Link
          href={`/products/${p.id}`}
          className="font-semibold leading-snug hover:text-brand-700"
        >
          {p.name}
        </Link>
        <p className="text-xs text-muted">
          <Link
            href={`/${p.org.type === "STORE" ? "stores" : "suppliers"}/${p.org.slug}`}
            className="hover:underline"
          >
            {p.org.name}
          </Link>
          {p.city ? ` · ${p.city}` : ""}
        </p>
        <div className="mt-auto pt-2">
          <p className="text-lg font-bold">
            {formatMoney(p.price.toString(), p.currency)}{" "}
            <span className="text-xs font-normal text-muted">/ {p.unit.name.toLowerCase()}</span>
          </p>
          <p className="text-xs text-muted">
            MOQ {formatQty(p.minOrderQty)}
            {p.deliveryAvailable ? " · Delivery available" : ""}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function OrgCard({
  o,
  basePath,
}: {
  o: {
    name: string;
    slug: string;
    city: string | null;
    description: string | null;
    logoUrl: string | null;
    verificationStatus: string;
    isDemo: boolean;
    categories: { name: string }[];
    supplierKind?: string | null;
    _count?: { products: number };
  };
  basePath: "suppliers" | "stores";
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {o.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={o.logoUrl}
            alt=""
            className="h-12 w-12 rounded-lg border border-line object-cover"
          />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-brand-50 font-bold text-brand-700">
            {o.name[0]}
          </div>
        )}
        <div className="min-w-0">
          <Link
            href={`/${basePath}/${o.slug}`}
            className="block truncate font-semibold hover:text-brand-700"
          >
            {o.name}
          </Link>
          <p className="text-xs text-muted">{o.city ?? "—"}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <VerifiedBadge status={o.verificationStatus} />
        <DemoBadge show={o.isDemo} />
        {o.supplierKind ? (
          <Badge>{SUPPLIER_KIND_LABEL[o.supplierKind as SupplierKind] ?? o.supplierKind}</Badge>
        ) : null}
        {o.categories.slice(0, 3).map((c) => (
          <Badge key={c.name}>{c.name}</Badge>
        ))}
      </div>
      {o.description ? <p className="line-clamp-2 text-sm text-muted">{o.description}</p> : null}
      {o._count ? <p className="text-xs text-muted">{o._count.products} active products</p> : null}
    </Card>
  );
}

export function Pagination({
  page,
  pages,
  params,
  basePath,
}: {
  page: number;
  pages: number;
  params: Record<string, string | undefined>;
  basePath: string;
}) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link
          className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface"
          href={href(page - 1)}
        >
          Previous
        </Link>
      ) : null}
      <span className="text-muted">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link
          className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface"
          href={href(page + 1)}
        >
          Next
        </Link>
      ) : null}
    </nav>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={it.name} className="flex items-center gap-1">
            {it.href ? (
              <Link href={it.href} className="hover:underline">
                {it.name}
              </Link>
            ) : (
              <span className="text-ink">{it.name}</span>
            )}
            {i < items.length - 1 ? <span aria-hidden>/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function SearchBox({
  defaultValue,
  action = "/marketplace",
  large,
}: {
  defaultValue?: string;
  action?: string;
  large?: boolean;
}) {
  return (
    <form action={action} role="search" className="flex w-full gap-2">
      <input
        name="q"
        defaultValue={defaultValue}
        aria-label="Search materials, brands or suppliers"
        placeholder="Search materials, brands or suppliers..."
        className={`w-full rounded-lg border border-line bg-white px-4 placeholder:text-slate-400 focus:border-brand-600 ${large ? "h-14 text-base" : "h-10 text-sm"}`}
      />
      <button
        className={`rounded-lg bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 ${large ? "h-14" : "h-10"}`}
        type="submit"
      >
        Search
      </button>
    </form>
  );
}
