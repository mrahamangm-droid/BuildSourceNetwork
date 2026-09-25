import type { Metadata } from "next";
import { db } from "@bmn/database";
import { requireCtx } from "@/server/access";
import { getOwnOrg } from "@/server/services/orgs";
import { PageHeader } from "@/components/ui";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { roleHas } from "@bmn/config";

export const metadata: Metadata = { title: "Company profile" };

export default async function ProfilePage() {
  const ctx = await requireCtx();
  const [org, categories] = await Promise.all([
    getOwnOrg(ctx),
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const publicHref =
    org.type === "SUPPLIER"
      ? `/suppliers/${org.slug}`
      : org.type === "STORE"
        ? `/stores/${org.slug}`
        : null;
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Company profile"
        description="This is how your company appears to others on the platform."
      />
      <ProfileForm
        org={org}
        categories={categories}
        canEdit={roleHas(ctx.role, "org.manage")}
        publicHref={publicHref}
      />
    </div>
  );
}
