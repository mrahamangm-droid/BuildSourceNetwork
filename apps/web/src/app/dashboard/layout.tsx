import type { Metadata } from "next";
import { db } from "@bmn/database";
import { requireCtx } from "@/server/access";
import { DashNav } from "@/components/dashboard/nav";
import { Badge } from "@/components/ui";
import { VerifyBanner } from "@/components/dashboard/verify-banner";
import { BUYER_TYPES, ORG_TYPE_LABEL } from "@bmn/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const org = await db.organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
    select: { name: true, isDemo: true },
  });
  const isSupplier = ctx.orgType === "SUPPLIER";
  const isBuyer = BUYER_TYPES.includes(ctx.orgType);
  const items = [
    { href: "/dashboard", label: "Overview" },
    ...(isSupplier || ctx.orgType === "STORE"
      ? [{ href: "/dashboard/products", label: "Products" }]
      : []),
    { href: "/dashboard/rfqs", label: isSupplier ? "RFQ inbox" : "RFQs" },
    { href: "/dashboard/orders", label: "Orders" },
    { href: "/dashboard/notifications", label: "Notifications" },
    { href: "/dashboard/profile", label: "Company profile" },
    { href: "/dashboard/verification", label: "Verification" },
    { href: "/dashboard/settings", label: "Settings" },
  ];
  void isBuyer;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="font-semibold">{org.name}</p>
        <Badge tone="brand">{ORG_TYPE_LABEL[ctx.orgType]}</Badge>
        {org.isDemo ? <Badge tone="amber">Demo</Badge> : null}
      </div>
      {!ctx.emailVerified ? (
        <div className="mb-4">
          <VerifyBanner />
        </div>
      ) : null}
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside>
          <DashNav items={items} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
import type { Metadata } from "next";
import { db } from "@bmn/database";
import { requireCtx } from "@/server/access";
import { DashNav } from "@/components/dashboard/nav";
import { Badge } from "@/components/ui";
import { VerifyBanner } from "@/components/dashboard/verify-banner";
import { BUYER_TYPES, ORG_TYPE_LABEL } from "@bmn/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const org = await db.organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
    select: { name: true, isDemo: true },
  });
  const isSupplier = ctx.orgType === "SUPPLIER";
  const isBuyer = BUYER_TYPES.includes(ctx.orgType);
  const items = [
    { href: "/dashboard", label: "Overview" },
    ...(isSupplier || ctx.orgType === "STORE"
      ? [{ href: "/dashboard/products", label: "Products" }]
      : []),
    { href: "/dashboard/rfqs", label: isSupplier ? "RFQ inbox" : "RFQs" },
    { href: "/dashboard/orders", label: "Orders" },
    { href: "/dashboard/notifications", label: "Notifications" },
    { href: "/dashboard/profile", label: "Company profile" },
    { href: "/dashboard/verification", label: "Verification" },
    { href: "/dashboard/settings", label: "Settings" },
  ];
  void isBuyer;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="font-semibold">{org.name}</p>
        <Badge tone="brand">{ORG_TYPE_LABEL[ctx.orgType]}</Badge>
        {org.isDemo ? <Badge tone="amber">Demo</Badge> : null}
      </div>
      {!ctx.emailVerified ? (
        <div className="mb-4">
          <VerifyBanner />
        </div>
      ) : null}
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside>
          <DashNav items={items} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
import type { Metadata } from "next";
import { db } from "@bmn/database";
import { requireCtx } from "@/server/access";
import { DashNav } from "@/components/dashboard/nav";
import { Badge } from "@/components/ui";
import { VerifyBanner } from "@/components/dashboard/verify-banner";
import { BUYER_TYPES, ORG_TYPE_LABEL } from "@bmn/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const org = await db.organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
    select: { name: true, isDemo: true },
  });
  const isSupplier = ctx.orgType === "SUPPLIER";
  const isBuyer = BUYER_TYPES.includes(ctx.orgType);
  const items = [
    { href: "/dashboard", label: "Overview" },
    ...(isSupplier || ctx.orgType === "STORE"
      ? [{ href: "/dashboard/products", label: "Products" }]
      : []),
    { href: "/dashboard/rfqs", label: isSupplier ? "RFQ inbox" : "RFQs" },
    { href: "/dashboard/orders", label: "Orders" },
    { href: "/dashboard/notifications", label: "Notifications" },
    { href: "/dashboard/profile", label: "Company profile" },
    { href: "/dashboard/verification", label: "Verification" },
    { href: "/dashboard/settings", label: "Settings" },
  ];
  void isBuyer;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="font-semibold">{org.name}</p>
        <Badge tone="brand">{ORG_TYPE_LABEL[ctx.orgType]}</Badge>
        {org.isDemo ? <Badge tone="amber">Demo</Badge> : null}
      </div>
      {!ctx.emailVerified ? (
        <div className="mb-4">
          <VerifyBanner />
        </div>
      ) : null}
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside>
          <DashNav items={items} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
import type { Metadata } from "next";
import { db } from "@bmn/database";
import { requireCtx } from "@/server/access";
import { DashNav } from "@/components/dashboard/nav";
import { Badge } from "@/components/ui";
import { VerifyBanner } from "@/components/dashboard/verify-banner";
import { BUYER_TYPES, ORG_TYPE_LABEL } from "@bmn/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const org = await db.organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
    select: { name: true, isDemo: true },
  });
  const isSupplier = ctx.orgType === "SUPPLIER";
  const isBuyer = BUYER_TYPES.includes(ctx.orgType);
  const items = [
    { href: "/dashboard", label: "Overview" },
    ...(isSupplier || ctx.orgType === "STORE"
      ? [{ href: "/dashboard/products", label: "Products" }]
      : []),
    { href: "/dashboard/rfqs", label: isSupplier ? "RFQ inbox" : "RFQs" },
    { href: "/dashboard/orders", label: "Orders" },
    { href: "/dashboard/notifications", label: "Notifications" },
    { href: "/dashboard/profile", label: "Company profile" },
    { href: "/dashboard/settings", label: "Settings" },
  ];
  void isBuyer;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="font-semibold">{org.name}</p>
        <Badge tone="brand">{ORG_TYPE_LABEL[ctx.orgType]}</Badge>
        {org.isDemo ? <Badge tone="amber">Demo</Badge> : null}
      </div>
      {!ctx.emailVerified ? (
        <div className="mb-4">
          <VerifyBanner />
        </div>
      ) : null}
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside>
          <DashNav items={items} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
