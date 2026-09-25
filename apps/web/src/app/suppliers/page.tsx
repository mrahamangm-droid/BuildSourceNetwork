import type { Metadata } from "next";
import { OrgDirectory } from "@/components/market/org-directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Building material suppliers",
  description: "Browse manufacturers, distributors and wholesalers of building materials.",
  alternates: { canonical: "/suppliers" },
};

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <OrgDirectory
      type="SUPPLIER"
      basePath="suppliers"
      title="Building material suppliers"
      sp={await searchParams}
    />
  );
}
