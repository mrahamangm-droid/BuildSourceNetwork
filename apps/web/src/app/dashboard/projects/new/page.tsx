import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCtx } from "@/server/access";
import { PageHeader } from "@/components/ui";
import { ProjectForm } from "@/components/dashboard/project-forms";
import { BUYER_TYPES, roleHas } from "@bmn/config";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  const ctx = await requireCtx();
  if (!BUYER_TYPES.includes(ctx.orgType) || !roleHas(ctx.role, "project.manage"))
    redirect("/dashboard");
  return (
    <div className="max-w-3xl">
      <PageHeader title="New project" />
      <ProjectForm />
    </div>
  );
}
