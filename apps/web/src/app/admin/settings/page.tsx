import type { Metadata } from "next";
import { requireAdmin } from "@/server/access";
import { getSettings } from "@/server/services/admin";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/dashboard/admin-forms";

export const metadata: Metadata = { title: "Platform settings" };

export default async function AdminSettings() {
  const a = await requireAdmin();
  const rows = await getSettings({ userId: a.id, isPlatformAdmin: true });
  return (
    <div className="space-y-4">
      <PageHeader title="Platform settings" description="Applies to new RFQs and orders." />
      <SettingsForm rows={rows} />
    </div>
  );
}
