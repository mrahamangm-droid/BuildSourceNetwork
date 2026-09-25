import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { ForgotForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <Card>
      <h1 className="mb-1 text-2xl font-bold">Forgot your password?</h1>
      <p className="mb-6 text-sm text-muted">Enter your email and we will send you a reset link.</p>
      <ForgotForm />
    </Card>
  );
}
