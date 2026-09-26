import { db } from "@bmn/database";
import type { Ctx } from "../ctx";
import { buildOnboardingSteps, onboardingProgress, type OnboardingStep } from "@/lib/onboarding";

/** Checklist for the caller's own supplier or store; null for buyers. */
export async function getOnboarding(
  ctx: Ctx,
): Promise<{ steps: OnboardingStep[]; done: number; total: number; percent: number } | null> {
  if (ctx.orgType !== "SUPPLIER" && ctx.orgType !== "STORE") return null;
  const [org, activeProducts, productsWithPhoto] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: ctx.orgId },
      select: {
        description: true,
        phone: true,
        logoUrl: true,
        deliveryAreas: true,
        leadTimeDays: true,
        minOrderNote: true,
        verificationStatus: true,
      },
    }),
    db.product.count({ where: { orgId: ctx.orgId, isActive: true } }),
    db.product.count({ where: { orgId: ctx.orgId, isActive: true, images: { some: {} } } }),
  ]);
  const steps = buildOnboardingSteps({
    emailVerified: ctx.emailVerified,
    description: org.description,
    phone: org.phone,
    logoUrl: org.logoUrl,
    deliveryAreas: org.deliveryAreas.length,
    leadTimeDays: org.leadTimeDays,
    minOrderNote: org.minOrderNote,
    activeProducts,
    productsWithPhoto,
    verificationStatus: org.verificationStatus,
  });
  return { steps, ...onboardingProgress(steps) };
}
