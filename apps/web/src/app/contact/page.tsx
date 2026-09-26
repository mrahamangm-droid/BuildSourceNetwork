import type { Metadata } from "next";
import { Card, LinkButton } from "@/components/ui";
import { BRAND, COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${BRAND.name}, operated by ${COMPANY.legalName}, ${COMPANY.location}.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Contact us</h1>
      <p className="mt-2 text-slate-600">
        Questions about suppliers, quotes, orders or your account? Email us and we will reply as
        soon as we can.
      </p>
      <Card className="mt-6 space-y-4 text-sm">
        <div>
          <p className="text-muted">Support</p>
          <a
            className="text-lg font-semibold text-brand-700 hover:underline"
            href={`mailto:${COMPANY.supportEmail}`}
          >
            {COMPANY.supportEmail}
          </a>
        </div>
        <div>
          <p className="text-muted">Operated by</p>
          <p className="font-semibold">{COMPANY.legalName}</p>
          <p>{COMPANY.location}</p>
        </div>
      </Card>
      <div className="mt-6 flex flex-wrap gap-3">
        <LinkButton href="/marketplace">Find materials</LinkButton>
        <LinkButton href="/request-quotes" variant="outline">
          Request quotes
        </LinkButton>
      </div>
    </div>
  );
}
