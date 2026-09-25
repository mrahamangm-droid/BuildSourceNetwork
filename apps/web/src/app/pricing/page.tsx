import type { Metadata } from "next";
import { Card, LinkButton } from "@/components/ui";
import { Breadcrumbs } from "@/components/market/parts";
import { PLANS } from "@bmn/config";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple plans for suppliers, stores and contractors. Start free.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Pricing" }]} />
      <h1 className="text-3xl font-bold tracking-tight">Simple pricing</h1>
      <p className="mt-2 text-muted">
        Start free. Upgrade as your business grows. Paid plans are activated by our team while
        online billing is being connected.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {PLANS.map((p) => (
          <Card key={p.code} className="flex flex-col">
            <h2 className="font-semibold">{p.name}</h2>
            <p className="mt-2 text-3xl font-bold">
              {p.priceMonthlyCents == null
                ? "Custom"
                : p.priceMonthlyCents === 0
                  ? "Free"
                  : `$${p.priceMonthlyCents / 100}`}
              {p.priceMonthlyCents ? (
                <span className="text-sm font-normal text-muted"> /month</span>
              ) : null}
            </p>
            <ul className="mt-4 flex-1 space-y-1 text-sm text-slate-700">
              {p.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <LinkButton
              className="mt-4"
              variant={p.code === "FREE" ? "primary" : "outline"}
              href={p.code === "ENTERPRISE" ? "/register" : "/register"}
            >
              {p.code === "FREE" ? "Start free" : "Get started"}
            </LinkButton>
          </Card>
        ))}
      </div>
    </div>
  );
}
