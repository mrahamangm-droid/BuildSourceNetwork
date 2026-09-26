import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";
import { Breadcrumbs, VerifiedBadge } from "@/components/market/parts";
import { CompareRemove, CompareSync } from "@/components/market/compare-remove";
import { buildCompareRows, COMPARE_MAX, parseCompareIds } from "@/lib/product-compare";
import { getCompareProducts } from "@/server/services/compare";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Compare products",
  robots: { index: false, follow: true },
};
export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; diff?: string }>;
}) {
  const sp = await searchParams;
  const requested = parseCompareIds(sp.ids);
  const products = await getCompareProducts(requested);
  const ids = products.map((p) => p.id);
  const onlyDiff = sp.diff === "1";
  const all = products.length
    ? buildCompareRows(
        products.map((p) => p.data),
        (n, c) => formatMoney(n.toString(), c),
      )
    : [];
  const rows = onlyDiff ? all.filter((r) => r.differs) : all;
  const q = (diff: boolean) => `/compare?ids=${ids.join(",")}${diff ? "&diff=1" : ""}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Marketplace", href: "/marketplace" },
          { name: "Compare" },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">Compare products</h1>
      {products.length < 2 ? (
        <div className="mt-6">
          <EmptyState
            title={products.length ? "Add one more product to compare" : "Nothing to compare yet"}
            body={`Press “Compare” on up to ${COMPARE_MAX} products in the marketplace, then come back here.`}
            action={
              <Link
                className="text-sm font-medium text-brand-700 hover:underline"
                href="/marketplace"
              >
                Browse the marketplace
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            <Link className="text-brand-700 hover:underline" href={q(!onlyDiff)}>
              {onlyDiff ? "Show all rows" : "Show only differences"}
            </Link>
            <CompareSync ids={ids} />
          </div>
          <Card className="mt-4 overflow-x-auto p-0">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="align-top">
                  <th className="sticky left-0 w-36 bg-white p-3" />
                  {products.map((p) => (
                    <th key={p.id} className="border-l border-line p-3 font-normal">
                      <Link
                        href={`/products/${p.id}`}
                        className="block aspect-[4/3] overflow-hidden rounded-lg bg-surface"
                      >
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image}
                            alt={p.data.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="grid h-full place-items-center text-xs text-muted">
                            No image
                          </span>
                        )}
                      </Link>
                      <Link
                        href={`/products/${p.id}`}
                        className="mt-2 block font-semibold leading-snug hover:text-brand-700"
                      >
                        {p.data.name}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <Link href={p.orgHref} className="text-xs text-muted hover:underline">
                          {p.data.fields.supplier}
                        </Link>
                        {p.verified ? <VerifiedBadge status="VERIFIED" /> : null}
                      </div>
                      <div className="mt-1">
                        <CompareRemove ids={ids} id={p.id} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className={cn("border-t border-line align-top", r.differs && "bg-amber-50/40")}
                  >
                    <th scope="row" className="sticky left-0 bg-white p-3 font-medium text-muted">
                      {r.label}
                    </th>
                    {r.values.map((v, i) => (
                      <td
                        key={i}
                        className={cn(
                          "whitespace-pre-line border-l border-line p-3",
                          r.best === i && "font-semibold text-green-700",
                        )}
                      >
                        {v ?? <span className="text-slate-400">—</span>}
                        {r.best === i ? (
                          <span className="ml-1 text-xs font-medium">Best</span>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={products.length + 1} className="p-6 text-center text-muted">
                      These products match on every detail shown.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-xs text-muted">
            Highlighted rows differ between products. “Best” is shown for price and minimum order
            only when products are priced per the same unit and currency.
          </p>
        </>
      )}
    </div>
  );
}
