import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BUYER_TYPES } from "@bmn/config";
import { requireCtx } from "@/server/access";
import { listLists } from "@/server/services/cart";
import { PageHeader } from "@/components/ui";
import { ListsIndex } from "@/components/dashboard/lists-view";

export const metadata: Metadata = { title: "Saved lists" };

export default async function ListsPage() {
  const ctx = await requireCtx();
  if (!BUYER_TYPES.includes(ctx.orgType)) redirect("/dashboard");
  const lists = await listLists(ctx);
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Saved lists"
        description="Keep the materials you reorder often and move a whole list to the cart in one click."
      />
      <ListsIndex lists={lists.map((l) => ({ ...l, updatedAt: l.updatedAt.toISOString() }))} />
    </div>
  );
}
