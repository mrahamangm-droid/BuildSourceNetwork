import type { Metadata } from "next";
import { db } from "@bmn/database";
import { requireCtx } from "@/server/access";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/dashboard/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireCtx();
  const user = await db.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { name: true, email: true, phone: true, notifyEmail: true, notifyInApp: true },
  });
  return (
    <div className="max-w-xl">
      <PageHeader
        title="Settings"
        description="Your personal profile and notification preferences."
      />
      <SettingsForm user={user} />
    </div>
  );
}
