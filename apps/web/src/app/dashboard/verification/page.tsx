import type { Metadata } from "next";
import { requireCtx } from "@/server/access";
import { getVerificationState } from "@/server/services/admin";
import { Alert, Badge, PageHeader } from "@/components/ui";
import { VerificationForm } from "@/components/dashboard/verification-form";
import { roleHas } from "@bmn/config";

export const metadata: Metadata = { title: "Business verification" };

export default async function VerificationPage() {
  const ctx = await requireCtx();
  const { org, latest } = await getVerificationState(ctx);
  const canEdit = roleHas(ctx.role, "org.manage");
  const status = org.verificationStatus;
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title="Business verification"
        description="Verified businesses get a badge on their profile and rank higher in search and supplier matching."
      />
      {org.isDemo ? (
        <Alert tone="info">Demo companies cannot be verified.</Alert>
      ) : status === "VERIFIED" ? (
        <Alert tone="success">
          Your business is verified <Badge tone="green">Verified business</Badge>
        </Alert>
      ) : status === "PENDING" ? (
        <Alert tone="info">
          Your request is under review. We will notify you once a decision is made.
        </Alert>
      ) : (
        <>
          {status === "REJECTED" && latest?.reviewNote ? (
            <Alert tone="error">
              Your last request was not approved: {latest.reviewNote}. You can correct the details
              and apply again.
            </Alert>
          ) : null}
          {!ctx.emailVerified ? (
            <Alert tone="info">Verify your email address before applying.</Alert>
          ) : canEdit ? (
            <VerificationForm defaultName={org.name} />
          ) : (
            <p className="text-sm text-muted">Only owners and admins can apply for verification.</p>
          )}
        </>
      )}
    </div>
  );
}
