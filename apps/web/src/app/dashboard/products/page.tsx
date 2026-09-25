import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/server/access";
import { listOwnProducts } from "@/server/services/products";
import { archiveProductAction } from "@/server/actions";
import { Alert, Badge, Button, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { StockBadge, Pagination } from "@/components/market/parts";
import { formatMoney } from "@/lib/utils";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; saved?: string }>;
}) {
  const ctx = await requireCtx();
  if (!["SUPPLIER", "STORE"].includes(ctx.orgType)) redirect("/dashboard");
  const sp = await searchParams;
  const res = await listOwnProducts(ctx, Number(sp.page) || 1);
  return (
    <div>
      <PageHeader
        title="Products"
        description="Your catalogue. Active products appear in the public marketplace."
        action={<LinkButton href="/dashboard/products/new">Add product</LinkButton>}
      />
      {sp.saved ? (
        <div className="mb-4">
          <Alert tone="success">Product saved.</Alert>
        </div>
      ) : null}
      {res.items.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {res.items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium hover:text-brand-700"
                      href={`/dashboard/products/${p.id}`}
                    >
                      {p.name}
                    </Link>
                    {p.sku ? <p className="text-xs text-muted">SKU {p.sku}</p> : null}
                  </td>
                  <td className="px-4 py-3">{p.category.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatMoney(p.price.toString(), p.currency)} / {p.unit.name.toLowerCase()}
                  </td>
                  <td className="px-4 py-3">
                    <StockBadge status={p.stockStatus} />
                  </td>
                  <td className="px-4 py-3">
                    {p.isActive ? <Badge tone="green">Listed</Badge> : <Badge>Hidden</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <LinkButton href={`/dashboard/products/${p.id}`} variant="outline" size="sm">
                      Edit
                    </LinkButton>{" "}
                    {p.isActive ? (
                      <form action={archiveProductAction} className="inline">
                        <input type="hidden" name="id" value={p.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Hide
                        </Button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No products yet"
          body="Add your first product so buyers can find and compare it."
          action={<LinkButton href="/dashboard/products/new">Add product</LinkButton>}
        />
      )}
      <Pagination
        page={res.page}
        pages={Math.max(1, Math.ceil(res.total / res.pageSize))}
        params={{}}
        basePath="/dashboard/products"
      />
    </div>
  );
}
