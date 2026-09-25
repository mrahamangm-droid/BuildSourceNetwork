import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCtx } from "@/server/access";

export const metadata: Metadata = { title: "Request quotes", robots: { index: false } };

/** Public entry point for every "Request Quotes / Get 3 Quotes" button: sign in first, then land on the form with the query preserved. */
export default async function RequestQuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  ).toString();
  const target = `/dashboard/rfqs/new${qs ? `?${qs}` : ""}`;
  if (await getCtx()) redirect(target);
  redirect(`/login?next=${encodeURIComponent(target)}`);
}
