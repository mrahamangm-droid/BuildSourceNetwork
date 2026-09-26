import type { Metadata } from "next";
import { OrgDirectory } from "@/components/market/org-directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Building material manufacturers",
  description:
    "Factories and producers of building materials that sell direct: lead times, minimum orders, capacity and certifications.",
  alternates: { canonical: "/manufacturers" },
};

export default async function ManufacturersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <OrgDirectory
      type="SUPPLIER"
      basePath="suppliers"
      listPath="/manufacturers"
      forceKind="MANUFACTURER"
      title="Building material manufacturers"
      sp={await searchParams}
    />
  );
}
