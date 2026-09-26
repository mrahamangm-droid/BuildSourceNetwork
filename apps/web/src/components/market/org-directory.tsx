import { db } from "@bmn/database";
import { Button, EmptyState, Input, Select } from "@/components/ui";
import { Breadcrumbs, OrgCard, Pagination } from "@/components/market/parts";
import { listPublicOrgs } from "@/server/services/orgs";
import { SUPPLIER_KINDS, SUPPLIER_KIND_LABEL, type SupplierKind } from "@bmn/config";
import { parseKind } from "@/lib/manufacturer";

export async function OrgDirectory({
  type,
  sp,
  basePath,
  title,
  forceKind,
  listPath,
}: {
  type: "SUPPLIER" | "STORE";
  sp: Record<string, string | undefined>;
  basePath: "suppliers" | "stores";
  title: string;
  /** Pin the directory to one supplier kind (used by /manufacturers). */
  forceKind?: SupplierKind;
  listPath?: string;
}) {
  const kind = forceKind ?? (type === "SUPPLIER" ? (parseKind(sp.kind ?? "") ?? undefined) : undefined);
  const [res, cats, cityRows] = await Promise.all([
    listPublicOrgs({
      type,
      city: sp.city,
      categorySlug: sp.category,
      kind,
      q: sp.q,
      page: Number(sp.page) || 1,
    }),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    db.organization.findMany({
      where: { type, isActive: true, city: { not: null }, ...(kind ? { supplierKind: kind } : {}) },
      distinct: ["city"],
      select: { city: true },
      orderBy: { city: "asc" },
    }),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: title }]} />
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_160px_160px_160px_auto]" method="get">
        <Input
          name="q"
          defaultValue={sp.q}
          placeholder="Search by name"
          aria-label="Search by name"
        />
        <Select name="category" defaultValue={sp.category ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
        {type === "SUPPLIER" && !forceKind ? (
          <Select name="kind" defaultValue={kind ?? ""} aria-label="Supplier type">
            {[["", "All types"], ...SUPPLIER_KINDS.map((k) => [k, SUPPLIER_KIND_LABEL[k]])].map(
              ([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ),
            )}
          </Select>
        ) : (
          <div className="hidden sm:block" />
        )}
        <Select name="city" defaultValue={sp.city ?? ""} aria-label="Location">
          <option value="">Any location</option>
          {cityRows.map((c) => (
            <option key={c.city!} value={c.city!}>
              {c.city}
            </option>
          ))}
        </Select>
        <Button type="submit">Filter</Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        {res.total} result{res.total === 1 ? "" : "s"}
      </p>
      {res.items.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {res.items.map((o) => (
            <OrgCard key={o.id} o={o} basePath={basePath} />
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState title="No companies found" body="Try a different category or location." />
        </div>
      )}
      <Pagination
        page={res.page}
        pages={Math.max(1, Math.ceil(res.total / res.pageSize))}
        params={sp}
        basePath={listPath ?? `/${basePath}`}
      />
    </div>
  );
}
