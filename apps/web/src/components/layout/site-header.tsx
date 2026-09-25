import Link from "next/link";
import { getCtx, getAdminUser } from "@/server/access";
import { logoutAction } from "@/server/actions";
import { db } from "@bmn/database";
import { LinkButton, Button } from "@/components/ui";
import { BUYER_TYPES } from "@bmn/config";

export async function SiteHeader() {
  const ctx = await getCtx();
  const unread = ctx
    ? await db.notification.count({ where: { userId: ctx.userId, readAt: null } })
    : 0;
  const adminUser = await getAdminUser();
  const isBuyer = ctx ? BUYER_TYPES.includes(ctx.orgType) : false;
  const nav = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/suppliers", label: "Suppliers" },
    { href: "/stores", label: "Stores" },
    ...(ctx
      ? [
          { href: "/dashboard/rfqs", label: "RFQs" },
          { href: "/dashboard/orders", label: "Orders" },
        ]
      : []),
    { href: "/pricing", label: "Pricing" },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            B
          </span>
          <span className="hidden sm:inline">Building Materials Network</span>
        </Link>
        <nav
          aria-label="Main"
          className="ml-4 hidden items-center gap-5 text-sm font-medium md:flex"
        >
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-slate-600 hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {adminUser && !ctx ? (
            <>
              <LinkButton href="/admin" variant="outline" size="sm">
                Admin
              </LinkButton>
              <form action={logoutAction}>
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : ctx ? (
            <>
              {adminUser ? (
                <LinkButton href="/admin" variant="ghost" size="sm">
                  Admin
                </LinkButton>
              ) : null}
              {isBuyer ? (
                <LinkButton href="/dashboard/rfqs/new" size="sm" className="hidden sm:inline-flex">
                  Request Quotes
                </LinkButton>
              ) : null}
              <Link
                href="/dashboard/notifications"
                className="relative rounded-lg px-2 py-1.5 text-sm hover:bg-surface"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
              >
                Alerts
                {unread ? (
                  <span className="ml-1 rounded-full bg-brand-600 px-1.5 text-xs text-white">
                    {unread}
                  </span>
                ) : null}
              </Link>
              <LinkButton href="/dashboard" variant="outline" size="sm">
                Dashboard
              </LinkButton>
              <form action={logoutAction}>
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" size="sm">
                Sign in
              </LinkButton>
              <LinkButton href="/register" size="sm">
                Join free
              </LinkButton>
            </>
          )}
        </div>
      </div>
      <nav
        aria-label="Main (mobile)"
        className="flex gap-4 overflow-x-auto border-t border-line px-4 py-2 text-sm font-medium md:hidden"
      >
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap text-slate-600">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
import Link from "next/link";
import { getCtx, getAdminUser } from "@/server/access";
import { logoutAction } from "@/server/actions";
import { db } from "@bmn/database";
import { LinkButton, Button } from "@/components/ui";
import { BUYER_TYPES } from "@bmn/config";

export async function SiteHeader() {
  const ctx = await getCtx();
  const unread = ctx
    ? await db.notification.count({ where: { userId: ctx.userId, readAt: null } })
    : 0;
  const adminUser = await getAdminUser();
  const isBuyer = ctx ? BUYER_TYPES.includes(ctx.orgType) : false;
  const nav = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/suppliers", label: "Suppliers" },
    { href: "/stores", label: "Stores" },
    ...(ctx
      ? [
          { href: "/dashboard/rfqs", label: "RFQs" },
          { href: "/dashboard/orders", label: "Orders" },
        ]
      : []),
    { href: "/pricing", label: "Pricing" },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            B
          </span>
          <span className="hidden sm:inline">Building Materials Network</span>
        </Link>
        <nav
          aria-label="Main"
          className="ml-4 hidden items-center gap-5 text-sm font-medium md:flex"
        >
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-slate-600 hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {adminUser && !ctx ? (
            <>
              <LinkButton href="/admin" variant="outline" size="sm">
                Admin
              </LinkButton>
              <form action={logoutAction}>
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : ctx ? (
            <>
              {adminUser ? (
                <LinkButton href="/admin" variant="ghost" size="sm">
                  Admin
                </LinkButton>
              ) : null}
              {isBuyer ? (
                <LinkButton href="/dashboard/rfqs/new" size="sm" className="hidden sm:inline-flex">
                  Request Quotes
                </LinkButton>
              ) : null}
              <Link
                href="/dashboard/notifications"
                className="relative rounded-lg px-2 py-1.5 text-sm hover:bg-surface"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
              >
                Alerts
                {unread ? (
                  <span className="ml-1 rounded-full bg-brand-600 px-1.5 text-xs text-white">
                    {unread}
                  </span>
                ) : null}
              </Link>
              <LinkButton href="/dashboard" variant="outline" size="sm">
                Dashboard
              </LinkButton>
              <form action={logoutAction}>
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" size="sm">
                Sign in
              </LinkButton>
              <LinkButton href="/register" size="sm">
                Join free
              </LinkButton>
            </>
          )}
        </div>
      </div>
      <nav
        aria-label="Main (mobile)"
        className="flex gap-4 overflow-x-auto border-t border-line px-4 py-2 text-sm font-medium md:hidden"
      >
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap text-slate-600">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
import Link from "next/link";
import { getCtx } from "@/server/access";
import { logoutAction } from "@/server/actions";
import { db } from "@bmn/database";
import { LinkButton, Button } from "@/components/ui";
import { BUYER_TYPES } from "@bmn/config";

export async function SiteHeader() {
  const ctx = await getCtx();
  const unread = ctx
    ? await db.notification.count({ where: { userId: ctx.userId, readAt: null } })
    : 0;
  const isBuyer = ctx ? BUYER_TYPES.includes(ctx.orgType) : false;
  const nav = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/suppliers", label: "Suppliers" },
    { href: "/stores", label: "Stores" },
    ...(ctx
      ? [
          { href: "/dashboard/rfqs", label: "RFQs" },
          { href: "/dashboard/orders", label: "Orders" },
        ]
      : []),
    { href: "/pricing", label: "Pricing" },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            B
          </span>
          <span className="hidden sm:inline">Building Materials Network</span>
        </Link>
        <nav
          aria-label="Main"
          className="ml-4 hidden items-center gap-5 text-sm font-medium md:flex"
        >
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-slate-600 hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {ctx ? (
            <>
              {isBuyer ? (
                <LinkButton href="/dashboard/rfqs/new" size="sm" className="hidden sm:inline-flex">
                  Request Quotes
                </LinkButton>
              ) : null}
              <Link
                href="/dashboard/notifications"
                className="relative rounded-lg px-2 py-1.5 text-sm hover:bg-surface"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
              >
                Alerts
                {unread ? (
                  <span className="ml-1 rounded-full bg-brand-600 px-1.5 text-xs text-white">
                    {unread}
                  </span>
                ) : null}
              </Link>
              <LinkButton href="/dashboard" variant="outline" size="sm">
                Dashboard
              </LinkButton>
              <form action={logoutAction}>
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" size="sm">
                Sign in
              </LinkButton>
              <LinkButton href="/register" size="sm">
                Join free
              </LinkButton>
            </>
          )}
        </div>
      </div>
      <nav
        aria-label="Main (mobile)"
        className="flex gap-4 overflow-x-auto border-t border-line px-4 py-2 text-sm font-medium md:hidden"
      >
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap text-slate-600">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
