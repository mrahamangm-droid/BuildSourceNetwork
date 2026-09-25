import type { Metadata } from "next";
import { OrgProfile } from "@/components/market/org-profile";
import { getPublicOrg } from "@/server/services/orgs";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = await getPublicOrg(slug, "SUPPLIER");
  if (!d) return { title: "Supplier not found", robots: { index: false } };
  return {
    title: `${d.org.name} — supplier${d.org.city ? ` in ${d.org.city}` : ""}`,
    description: d.org.description ?? `Products, prices and quotes from ${d.org.name}.`,
    alternates: { canonical: `/suppliers/${slug}` },
  };
}

export default async function SupplierPage({ params }: { params: Promise<{ slug: string }> }) {
  return <OrgProfile slug={(await params).slug} type="SUPPLIER" basePath="suppliers" />;
}
