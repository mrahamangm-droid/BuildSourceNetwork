import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@bmn/database";
import { BUYER_TYPES } from "@bmn/config";
import { requireCtx } from "@/server/access";
import { getCart } from "@/server/services/cart";
import { PageHeader } from "@/components/ui";
import { CartView } from "@/components/dashboard/cart-view";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const ctx = await requireCtx();
  if (!BUYER_TYPES.includes(ctx.orgType)) redirect("/dashboard");
  const [cart, org] = await Promise.all([
    getCart(ctx),
    db.organization.findUnique({ where: { id: ctx.orgId }, select: { city: true } }),
  ]);
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Cart"
        description="Order from several suppliers at once. Each supplier receives its own order."
      />
      <CartView cart={cart} defaultCity={org?.city ?? ""} />
    </div>
  );
}
