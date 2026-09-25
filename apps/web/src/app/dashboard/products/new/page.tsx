import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@bmn/database";
import { requireCtx } from "@/server/access";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/dashboard/product-form";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const ctx = await requireCtx();
  if (!["SUPPLIER", "STORE"].includes(ctx.orgType)) redirect("/dashboard");
  const [categories, units] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.unit.findMany({ orderBy: { name: "asc" }, select: { code: true, name: true } }),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add product" />
      <ProductForm values={{}} categories={categories} units={units} />
    </div>
  );
}
