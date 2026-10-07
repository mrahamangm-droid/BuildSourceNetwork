import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { RegisterForm } from "@/components/auth/forms";
import { getCtx } from "@/server/access";
import { ORG_TYPES, type OrgType } from "@bmn/config";

export const metadata: Metadata = {
  title: "Create your free account",
  description:
    "Create a free account to join as a supplier, store, contractor or buyer, then list materials, request quotes and manage orders.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  if (await getCtx()) redirect("/dashboard");
  const { type } = await searchParams;
  const t = ORG_TYPES.includes(type as OrgType) ? (type as OrgType) : undefined;
  return (
    <Card>
      <h1 className="mb-1 text-2xl font-bold">Create your free account</h1>
      <p className="mb-6 text-sm text-muted">Set up your company in a minute. No card required.</p>
      <RegisterForm defaultType={t} />
    </Card>
  );
}
