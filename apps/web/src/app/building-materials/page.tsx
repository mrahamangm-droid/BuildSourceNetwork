import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/market/parts";
import { categoriesWithCounts } from "@/server/services/products";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Building materials by category",
  description:
    "Browse building materials by category: cement, steel, blocks, tiles, sand and more.",
  alternates: { canonical: "/building-materials" },
};

export default async function CategoriesPage() {
  const cats = await categoriesWithCounts();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Building materials" }]} />
      <h1 className="text-3xl font-bold tracking-tight">Building materials by category</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cats.map((c) =>
          c._count.products > 0 ? (
            <Link key={c.id} href={`/building-materials/${c.slug}`}>
              <Card className="hover:border-brand-600">
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted">
                  {c._count.products} product{c._count.products === 1 ? "" : "s"}
                </p>
              </Card>
            </Link>
          ) : (
            <Card key={c.id} className="opacity-60">
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-muted">No listings yet</p>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}
