import { db } from "@bmn/database";
import { roleHas, type MemberRole, type OrgType, type Permission, BUYER_TYPES } from "@bmn/config";
import { AppError } from "./errors";

/**
 * The tenancy boundary. Every service takes a Ctx and filters by ctx.orgId, so a company can only
 * ever read or write rows that carry its own organization id.
 */
export type Ctx = {
  userId: string;
  orgId: string;
  orgType: OrgType;
  role: MemberRole;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
};

export function assertCan(ctx: Ctx, permission: Permission) {
  if (!roleHas(ctx.role, permission))
    throw new AppError("You do not have permission to do that.", "FORBIDDEN");
}

export function assertOrgType(ctx: Ctx, ...types: OrgType[]) {
  if (!types.includes(ctx.orgType))
    throw new AppError("This action is not available for your account type.", "FORBIDDEN");
}

export function assertBuyer(ctx: Ctx) {
  assertOrgType(ctx, ...BUYER_TYPES);
}

export function assertVerified(ctx: Ctx) {
  if (!ctx.emailVerified)
    throw new AppError("Please verify your email address first.", "FORBIDDEN");
}

export async function buildCtx(userId: string): Promise<Ctx | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { org: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const m = user?.memberships[0];
  if (!user || !m || !m.org.isActive) return null;
  return {
    userId: user.id,
    orgId: m.orgId,
    orgType: m.org.type,
    role: m.role,
    emailVerified: !!user.emailVerifiedAt,
    isPlatformAdmin: user.isPlatformAdmin,
  };
}
