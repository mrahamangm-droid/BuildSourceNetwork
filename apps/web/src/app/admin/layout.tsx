import type { Metadata } from "next";
import { requireAdmin } from "@/server/access";
import { DashNav } from "@/components/dashboard/nav";
import { Badge } from "@/components/ui";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const items = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/verification", label: "Verification queue" },
    { href: "/admin/plans", label: "Plan requests" },
    { href: "/admin/organizations", label: "Companies" },
    { href: "/admin/settings", label: "Platform settings" },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="font-semibold">Platform admin</p>
        <Badge tone="amber">{admin.email}</Badge>
      </div>
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside>
          <DashNav items={items} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
