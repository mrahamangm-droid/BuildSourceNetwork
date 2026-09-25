import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCtx } from "@/server/access";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "@/components/dashboard/customer-forms";
import { roleHas } from "@bmn/config";

export const metadata: Metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  const ctx = await requireCtx();
  if (!["SUPPLIER", "STORE"].includes(ctx.orgType) || !roleHas(ctx.role, "customer.manage"))
    redirect("/dashboard");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add customer" />
      <CustomerForm />
    </div>
  );
}
