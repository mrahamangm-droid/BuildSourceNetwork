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
  const d = await getPublicOrg(slug, "STORE");
  if (!d) return { title: "Store not found", robots: { index: false } };
  return {
    title: `${d.org.name} — store${d.org.city ? ` in ${d.org.city}` : ""}`,
    description: d.org.description ?? `Products and prices from ${d.org.name}.`,
    alternates: { canonical: `/stores/${slug}` },
  };
}

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  return <OrgProfile slug={(await params).slug} type="STORE" basePath="stores" />;
}
