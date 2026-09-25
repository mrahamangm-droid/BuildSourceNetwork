import type { Metadata } from "next";
import { OrgDirectory } from "@/components/market/org-directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Building material stores",
  description: "Find building-material shops and traders near you.",
  alternates: { canonical: "/stores" },
};

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <OrgDirectory
      type="STORE"
      basePath="stores"
      title="Building material stores"
      sp={await searchParams}
    />
  );
}
