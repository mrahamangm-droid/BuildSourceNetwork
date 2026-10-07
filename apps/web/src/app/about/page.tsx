import type { Metadata } from "next";
import { Card, LinkButton } from "@/components/ui";
import { Breadcrumbs } from "@/components/market/parts";
import { BRAND, COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "About",
  description: `${BRAND.name} helps buyers find building-material suppliers, compare quotes and manage orders. Operated by ${COMPANY.legalName}, ${COMPANY.location}.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "About" }]} />
      <h1 className="text-3xl font-bold tracking-tight">About {BRAND.name}</h1>
      <p className="mt-3 text-slate-700">{BRAND.tagline}</p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-700">
        <p>
          {BRAND.name} is an online marketplace and software service for the building-materials
          industry. Buyers search for materials, send one request to several suppliers, compare the
          quotes side by side and place the order. Suppliers and stores list their stock and prices,
          answer requests in one place and track deliveries.
        </p>
        <p>
          Each company&apos;s requests, quotes and orders stay private to that company. Business
          profiles can be verified, and buyers can read reviews from real transactions.
        </p>
      </div>
      <Card className="mt-8 space-y-3 text-sm">
        <div>
          <p className="text-muted">Operated by</p>
          <p className="font-semibold">{COMPANY.legalName}</p>
          <p>{COMPANY.location}</p>
        </div>
        <div>
          <p className="text-muted">Contact</p>
          <a className="text-brand-700 hover:underline" href={`mailto:${COMPANY.supportEmail}`}>
            {COMPANY.supportEmail}
          </a>
        </div>
      </Card>
      <div className="mt-6 flex flex-wrap gap-3">
        <LinkButton href="/marketplace">Find materials</LinkButton>
        <LinkButton href="/contact" variant="outline">
          Contact us
        </LinkButton>
      </div>
    </div>
  );
}
