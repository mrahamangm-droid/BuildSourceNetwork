import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BUYER_TYPES } from "@bmn/config";
import { requireCtx } from "@/server/access";
import { getList } from "@/server/services/cart";
import { PageHeader } from "@/components/ui";
import { ListDetail } from "@/components/dashboard/lists-view";

export const metadata: Metadata = { title: "Saved list" };

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  if (!BUYER_TYPES.includes(ctx.orgType)) redirect("/dashboard");
  const list = await getList(ctx, (await params).id);
  if (!list) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={list.name}
        action={
          <Link href="/dashboard/lists" className="text-sm text-brand-700 hover:underline">
            All lists
          </Link>
        }
      />
      <ListDetail list={list} />
    </div>
  );
}
