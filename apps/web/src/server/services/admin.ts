import { z } from "zod";
import { db } from "@bmn/database";
import type { Ctx } from "../ctx";
import { assertCan } from "../ctx";
import { AppError } from "../errors";
import { fieldErrorsFrom } from "./accounts";
import { audit, notifyOrg } from "./notify";

/** Minimal actor for admin operations (admins need not belong to an organization). */
export type AdminActor = { userId: string; isPlatformAdmin: boolean };

export function assertAdmin(actor: AdminActor) {
  if (!actor.isPlatformAdmin) throw new AppError("Admin access required.", "FORBIDDEN");
}

// ───────────────────────── company verification (org side) ─────────────────────────

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || v.startsWith("/api/files/") || /^https:\/\//i.test(v), "Invalid file");

export const verificationSchema = z.object({
  legalName: z.string().trim().min(2, "Enter the registered company name").max(160),
  licenseNumber: z.string().trim().min(3, "Enter the trade licence number").max(60),
  licenseAuthority: z.string().trim().max(120).optional().default(""),
  taxNumber: z.string().trim().max(40).optional().default(""),
  licenseDocUrl: optionalUrl.optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
});

export async function getVerificationState(ctx: Ctx) {
  const [org, latest] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: ctx.orgId },
      select: { name: true, verificationStatus: true, isDemo: true },
    }),
    db.verificationRequest.findFirst({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { org, latest };
}

export async function submitVerification(ctx: Ctx, raw: unknown) {
  assertCan(ctx, "org.manage");
  if (!ctx.emailVerified)
    throw new AppError("Please verify your email address first.", "FORBIDDEN");
  const parsed = verificationSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "Please fix the highlighted fields.",
      "VALIDATION",
      fieldErrorsFrom(parsed.error),
    );
  const d = parsed.data;
  const org = await db.organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
    select: { verificationStatus: true, isDemo: true },
  });
  if (org.isDemo)
    throw new AppError("Demo companies cannot be verified.", "FORBIDDEN");
  if (org.verificationStatus === "VERIFIED")
    throw new AppError("Your business is already verified.", "CONFLICT");
  if (org.verificationStatus === "PENDING")
    throw new AppError("Your verification request is already under review.", "CONFLICT");

  const req = await db.$transaction(async (tx) => {
    const created = await tx.verificationRequest.create({
      data: {
        orgId: ctx.orgId,
        status: "PENDING",
        legalName: d.legalName,
        licenseNumber: d.licenseNumber,
        licenseAuthority: d.licenseAuthority || null,
        taxNumber: d.taxNumber || null,
        licenseDocUrl: d.licenseDocUrl || null,
        notes: d.notes || null,
        submittedById: ctx.userId,
      },
    });
    // Conditional update: only one PENDING request can win a race.
    const moved = await tx.organization.updateMany({
      where: { id: ctx.orgId, verificationStatus: { in: ["UNVERIFIED", "REJECTED"] } },
      data: { verificationStatus: "PENDING" },
    });
    if (moved.count !== 1)
      throw new AppError("Your verification request is already under review.", "CONFLICT");
    return created;
  });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "verification.submitted",
    entity: "VerificationRequest",
    entityId: req.id,
  });
  return req;
}

// ───────────────────────── admin side ─────────────────────────

export async function reviewVerification(
  actor: AdminActor,
  requestId: string,
  decision: "APPROVE" | "REJECT",
  note: string,
) {
  assertAdmin(actor);
  const cleanNote = note.trim().slice(0, 1000);
  if (decision === "REJECT" && cleanNote.length < 3)
    throw new AppError("Please give the company a reason for the rejection.", "VALIDATION", {
      note: "Enter a reason",
    });
  const req = await db.verificationRequest.findUnique({
    where: { id: requestId },
    include: { org: { select: { id: true, name: true, isDemo: true } } },
  });
  if (!req) throw new AppError("Request not found.", "NOT_FOUND");
  if (decision === "APPROVE" && req.org.isDemo)
    throw new AppError("Demo companies are never marked verified.", "FORBIDDEN");

  const status = decision === "APPROVE" ? "VERIFIED" : "REJECTED";
  await db.$transaction(async (tx) => {
    // Only a PENDING request can be decided, exactly once.
    const claimed = await tx.verificationRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status, reviewedById: actor.userId, reviewedAt: new Date(), reviewNote: cleanNote || null },
    });
    if (claimed.count !== 1)
      throw new AppError("This request has already been reviewed.", "CONFLICT");
    await tx.organization.update({
      where: { id: req.orgId },
      data: { verificationStatus: status },
    });
  });
  await audit({
    orgId: req.orgId,
    actorId: actor.userId,
    action: decision === "APPROVE" ? "verification.approved" : "verification.rejected",
    entity: "VerificationRequest",
    entityId: requestId,
    meta: cleanNote ? { note: cleanNote } : undefined,
  });
  await notifyOrg({
    orgId: req.orgId,
    type: "verification",
    title:
      decision === "APPROVE"
        ? "Your business is now verified"
        : "Your verification request was not approved",
    body: decision === "APPROVE" ? "A Verified business badge now shows on your profile." : cleanNote,
    href: "/dashboard/verification",
  });
}

export async function listVerificationRequests(
  actor: AdminActor,
  status: "PENDING" | "VERIFIED" | "REJECTED" = "PENDING",
) {
  assertAdmin(actor);
  return db.verificationRequest.findMany({
    where: { status },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 100,
    include: {
      org: { select: { id: true, name: true, type: true, city: true, email: true, phone: true } },
    },
  });
}

export async function adminOverview(actor: AdminActor) {
  assertAdmin(actor);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [orgs, users, pendingVerif, rfqs30, orders30, gmv, openRfqs, recent] = await Promise.all([
    db.organization.groupBy({ by: ["type"], _count: true, where: { isDemo: false } }),
    db.user.count({ where: { isDemo: false } }),
    db.verificationRequest.count({ where: { status: "PENDING" } }),
    db.rfq.count({ where: { createdAt: { gte: since }, isDemo: false } }),
    db.order.count({ where: { createdAt: { gte: since }, isDemo: false } }),
    db.order.aggregate({
      _sum: { totalAmount: true },
      where: { isDemo: false, status: { not: "CANCELLED" }, createdAt: { gte: since } },
    }),
    db.rfq.count({ where: { status: "OPEN", isDemo: false } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { org: { select: { name: true } }, actor: { select: { email: true } } },
    }),
  ]);
  return {
    orgsByType: orgs.map((o) => ({ type: o.type, count: o._count })),
    totalOrgs: orgs.reduce((n, o) => n + o._count, 0),
    users,
    pendingVerif,
    rfqs30,
    orders30,
    gmv30: Number(gmv._sum.totalAmount ?? 0),
    openRfqs,
    recent,
  };
}

export async function listOrganizations(
  actor: AdminActor,
  f: { q?: string; type?: string; status?: string; page?: number } = {},
) {
  assertAdmin(actor);
  const pageSize = 25;
  const page = Math.max(1, f.page ?? 1);
  const where = {
    ...(f.q
      ? {
          OR: [
            { name: { contains: f.q, mode: "insensitive" as const } },
            { city: { contains: f.q, mode: "insensitive" as const } },
            { email: { contains: f.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(f.type && ["SUPPLIER", "STORE", "CONTRACTOR", "BUYER"].includes(f.type)
      ? { type: f.type as "SUPPLIER" | "STORE" | "CONTRACTOR" | "BUYER" }
      : {}),
    ...(f.status && ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"].includes(f.status)
      ? { verificationStatus: f.status as "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" }
      : {}),
  };
  const [total, items] = await Promise.all([
    db.organization.count({ where }),
    db.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        verificationStatus: true,
        isActive: true,
        isDemo: true,
        createdAt: true,
        _count: { select: { members: true, products: true } },
      },
    }),
  ]);
  return { total, items, page, pageSize };
}

export async function setOrgActive(actor: AdminActor, orgId: string, isActive: boolean) {
  assertAdmin(actor);
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) throw new AppError("Organization not found.", "NOT_FOUND");
  await db.organization.update({ where: { id: orgId }, data: { isActive } });
  await audit({
    orgId,
    actorId: actor.userId,
    action: isActive ? "org.reactivated" : "org.suspended",
    entity: "Organization",
    entityId: orgId,
  });
}

/** Revoke a previously granted verification (e.g. licence expired). */
export async function revokeVerification(actor: AdminActor, orgId: string, reason: string) {
  assertAdmin(actor);
  const r = reason.trim().slice(0, 1000);
  if (r.length < 3)
    throw new AppError("Enter a reason.", "VALIDATION", { note: "Enter a reason" });
  const moved = await db.organization.updateMany({
    where: { id: orgId, verificationStatus: "VERIFIED" },
    data: { verificationStatus: "UNVERIFIED" },
  });
  if (moved.count !== 1) throw new AppError("This company is not verified.", "CONFLICT");
  await audit({
    orgId,
    actorId: actor.userId,
    action: "verification.revoked",
    entity: "Organization",
    entityId: orgId,
    meta: { reason: r },
  });
  await notifyOrg({
    orgId,
    type: "verification",
    title: "Your verified status was removed",
    body: r,
    href: "/dashboard/verification",
  });
}

// ───────────────────────── platform settings ─────────────────────────

export const SETTING_DEFS = {
  platformFeeBps: { label: "Platform fee (basis points)", min: 0, max: 2000, fallback: "100" },
  rfqExpiryDays: { label: "RFQ expiry (days)", min: 1, max: 60, fallback: "7" },
} as const;
export type SettingKey = keyof typeof SETTING_DEFS;

export async function getSettings(actor: AdminActor) {
  assertAdmin(actor);
  const rows = await db.platformSetting.findMany({
    where: { key: { in: Object.keys(SETTING_DEFS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return (Object.keys(SETTING_DEFS) as SettingKey[]).map((key) => ({
    key,
    label: SETTING_DEFS[key].label,
    value: map.get(key) ?? SETTING_DEFS[key].fallback,
  }));
}

export async function updateSettings(actor: AdminActor, raw: Record<string, unknown>) {
  assertAdmin(actor);
  const errors: Record<string, string> = {};
  const updates: [SettingKey, string][] = [];
  for (const key of Object.keys(SETTING_DEFS) as SettingKey[]) {
    const def = SETTING_DEFS[key];
    const v = Number(raw[key]);
    if (!Number.isInteger(v) || v < def.min || v > def.max)
      errors[key] = `Enter a whole number from ${def.min} to ${def.max}`;
    else updates.push([key, String(v)]);
  }
  if (Object.keys(errors).length)
    throw new AppError("Please fix the highlighted fields.", "VALIDATION", errors);
  for (const [key, value] of updates)
    await db.platformSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  await audit({ actorId: actor.userId, action: "settings.updated", meta: Object.fromEntries(updates) });
}
