import type { Metadata } from "next";
import { Alert, Card, LinkButton } from "@/components/ui";
import { verifyEmail } from "@/server/services/accounts";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const ok = token ? await verifyEmail(token) : false;
  return (
    <Card>
      <h1 className="mb-4 text-2xl font-bold">Email verification</h1>
      {ok ? (
        <Alert tone="success">
          Your email is verified. You can now post products, request and send quotes.
        </Alert>
      ) : (
        <Alert tone="error">
          This verification link is invalid or has expired. Sign in and request a new one from your
          dashboard.
        </Alert>
      )}
      <div className="mt-6">
        <LinkButton href="/dashboard">Go to dashboard</LinkButton>
      </div>
    </Card>
  );
}
