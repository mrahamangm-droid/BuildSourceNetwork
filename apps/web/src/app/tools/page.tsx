import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { Breadcrumbs } from "@/components/market/parts";
import { CALCULATORS } from "@/lib/calculators";

export const metadata: Metadata = {
  title: "Free construction calculators",
  description:
    "Free concrete, cement, block, tile, paint and steel calculators, plus an area calculator and a building material estimator.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Tools" }]} />
      <h1 className="text-3xl font-bold tracking-tight">Free construction calculators</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Estimate quantities in seconds, then turn the result into a quote request to verified
        suppliers.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CALCULATORS.map((c) => (
          <Link key={c.slug} href={`/tools/${c.slug}`}>
            <Card className="h-full transition-colors hover:border-brand-600">
              <h2 className="font-semibold">{c.name}</h2>
              <p className="mt-1 text-sm text-muted">{c.short}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
