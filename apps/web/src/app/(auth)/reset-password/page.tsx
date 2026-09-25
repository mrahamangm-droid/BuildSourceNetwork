import type { Metadata } from "next";
import { Alert, Card } from "@/components/ui";
import { ResetForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <Card>
      <h1 className="mb-6 text-2xl font-bold">Choose a new password</h1>
      {token ? (
        <ResetForm token={token} />
      ) : (
        <Alert tone="error">This reset link is missing its token. Request a new one.</Alert>
      )}
    </Card>
  );
}
