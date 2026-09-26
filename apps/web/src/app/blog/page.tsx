import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";
import { Breadcrumbs, Pagination } from "@/components/market/parts";
import { listPublished } from "@/server/services/blog";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Buying guides for building materials",
  description: "Practical guides on requesting quotes, comparing suppliers and buying construction materials.",
  alternates: { canonical: "/blog" },
};

export default async function BlogIndex({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tag = sp.tag && /^[a-z0-9-]{1,30}$/.test(sp.tag) ? sp.tag : undefined;
  const res = await listPublished({ page: Number(sp.page) || 1, tag });
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Blog" }]} />
      <h1 className="text-3xl font-bold tracking-tight">Buying guides</h1>
      <p className="mt-2 text-muted">
        Practical advice on requesting quotes, comparing suppliers and buying materials.
        {tag ? ` Showing: ${tag}.` : ""}
      </p>
      {res.items.length ? (
        <div className="mt-6 space-y-4">
          {res.items.map((p) => (
            <Card key={p.id}>
              <h2 className="text-xl font-semibold">
                <Link href={`/blog/${p.slug}`} className="hover:text-brand-700">
                  {p.title}
                </Link>
              </h2>
              <p className="mt-1 text-xs text-muted">{formatDate(p.publishedAt)}</p>
              <p className="mt-2 text-sm text-slate-700">{p.excerpt}</p>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState title="No articles yet" body="Check back soon." />
        </div>
      )}
      <Pagination
        page={res.page}
        pages={Math.max(1, Math.ceil(res.total / res.pageSize))}
        params={sp}
        basePath="/blog"
      />
    </div>
  );
}
