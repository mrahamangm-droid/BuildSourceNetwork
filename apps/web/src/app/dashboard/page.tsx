import type { Metadata } from "next";
import Link from "next/link";
import { requireCtx } from "@/server/access";
import { dashboardStats } from "@/server/services/orders";
import { db } from "@bmn/database";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const inner = (
    <Card className="h-full">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const s = await dashboardStats(ctx);
  const org = await db.organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
    select: { currency: true, description: true, phone: true, logoUrl: true },
  });
  const isSupplier = ctx.orgType === "SUPPLIER";
  const profileIncomplete = !org.description || !org.phone;

  return (
    <div>
      <PageHeader
        title="Overview"
        description={
          isSupplier
            ? "Incoming RFQs, quotes and orders for your business."
            : "Your requests for quotes, supplier offers and orders."
        }
        action={
          isSupplier ? (
            <LinkButton href="/dashboard/products/new">Add product</LinkButton>
          ) : (
            <LinkButton href="/dashboard/rfqs/new">Request Quotes</LinkButton>
          )
        }
      />
      {sp.welcome ? (
        <div className="mb-4">
          <Alert tone="success">
            Welcome! Your account is ready.
            {isSupplier
              ? " Start by adding your products so buyers can find you."
              : " Search the marketplace or request quotes to get going."}
          </Alert>
        </div>
      ) : null}
      {profileIncomplete ? (
        <div className="mb-4">
          <Alert>
            Complete your{" "}
            <Link className="underline" href="/dashboard/profile">
              company profile
            </Link>{" "}
            (description and phone) so counterparties can trust and reach you.
          </Alert>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {s.kind === "supplier" ? (
          <>
            <Stat label="RFQs awaiting your quote" value={s.toQuote} href="/dashboard/rfqs" />
            <Stat label="Quotes sent" value={s.quotes} href="/dashboard/rfqs" />
            <Stat label="Active products" value={s.products} href="/dashboard/products" />
            <Stat label="Open orders" value={s.openOrders} href="/dashboard/orders" />
            <Stat label="Total orders" value={s.orders} href="/dashboard/orders" />
            <Stat label="Order value" value={formatMoney(s.total, org.currency)} />
          </>
        ) : (
          <>
            <Stat label="Open RFQs" value={s.openRfqs} href="/dashboard/rfqs" />
            <Stat label="Quotes to review" value={s.quotesReceived} href="/dashboard/rfqs" />
            <Stat label="Open orders" value={s.openOrders} href="/dashboard/orders" />
            <Stat label="Total orders" value={s.orders} href="/dashboard/orders" />
            <Stat label="Total RFQs" value={s.rfqs} href="/dashboard/rfqs" />
            <Stat label="Order value" value={formatMoney(s.total, org.currency)} />
          </>
        )}
        <Stat label="Unread notifications" value={s.unread} href="/dashboard/notifications" />
      </div>
    </div>
  );
}
