import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { Breadcrumbs, JsonLd } from "@/components/market/parts";
import { CalculatorForm } from "@/components/tools/calculator-form";
import { CALCULATORS, getCalculator } from "@/lib/calculators";
import { appUrl } from "@/lib/utils";

export function generateStaticParams() {
  return CALCULATORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const c = getCalculator((await params).slug);
  if (!c) return {};
  return {
    title: c.name,
    description: c.description,
    alternates: { canonical: `/tools/${c.slug}` },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = getCalculator((await params).slug);
  if (!c) notFound();
  const url = `${appUrl()}/tools/${c.slug}`;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebApplication",
              name: c.name,
              description: c.description,
              url,
              applicationCategory: "UtilitiesApplication",
              operatingSystem: "Any",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            },
            {
              "@type": "FAQPage",
              mainEntity: c.faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ],
        }}
      />
      <Breadcrumbs
        items={[{ name: "Home", href: "/" }, { name: "Tools", href: "/tools" }, { name: c.name }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">{c.name}</h1>
      <p className="mt-2 max-w-2xl text-muted">{c.description}</p>
      <div className="mt-6">
        <CalculatorForm slug={c.slug} />
      </div>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Common questions</h2>
        <div className="mt-3 space-y-3">
          {c.faqs.map((f) => (
            <Card key={f.q}>
              <h3 className="font-medium">{f.q}</h3>
              <p className="mt-1 text-sm text-slate-700">{f.a}</p>
            </Card>
          ))}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">More calculators</h2>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {CALCULATORS.filter((x) => x.slug !== c.slug).map((x) => (
            <li key={x.slug}>
              <Link
                href={`/tools/${x.slug}`}
                className="rounded-full border border-line px-3 py-1 hover:bg-surface"
              >
                {x.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
