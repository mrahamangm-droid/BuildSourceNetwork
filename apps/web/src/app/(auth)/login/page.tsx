import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { LoginForm } from "@/components/auth/forms";
import { getCtx } from "@/server/access";
import { safeNext } from "@/server/actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  const next = await safeNext(sp.next);
  if (await getCtx()) redirect(next);
  return (
    <Card>
      <h1 className="mb-1 text-2xl font-bold">Sign in</h1>
      <p className="mb-6 text-sm text-muted">Welcome back. Access your RFQs, quotes and orders.</p>
      <LoginForm next={next} reset={sp.reset === "1"} />
    </Card>
  );
}
