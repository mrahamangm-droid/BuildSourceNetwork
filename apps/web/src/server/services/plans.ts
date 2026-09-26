import { z } from "zod";
import { db, Prisma } from "@bmn/database";
import { assertCan, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { audit, notifyOrg } from "./notify";
import type { AdminActor } from "./admin";
import { assertAdmin } from "./admin";
import { effectiveLimits, nextPeriodEnd, requestablePlan, type PlanRow } from "@/lib/plans";

async function plansOf(): Promise<(PlanRow & { priceMonthlyCents: number | null; isActive: boolean })[]> {
  const rows = await db.subscriptionPlan.findMany({ orderBy: { priceMonthlyCents: { sort: "asc", nulls: "last" } } });
  return rows.map((p) => ({
    code: p.code,
    name: p.name,
    productLimit: p.productLimit,
    rfqLimit: p.rfqLimit,
    priceMonthlyCents: p.priceMonthlyCents,
    isActive: p.isActive,
  }));
}

/** The limits that actually apply to an org right now (lapsed paid plans fall back to Free). */
export async function getEffectiveLimits(orgId: string) {
  const [sub, plans] = await Promise.all([db.subscription.findUnique({ where: { orgId } }), plansOf()]);
  return effectiveLimits(sub, plans);
}

/** Used by product and RFQ creation. Throws when the org is at its limit. */
export async function assertWithinLimit(orgId: string, kind: "product" | "rfq") {
  const lim = await getEffectiveLimits(orgId);
  const limit = kind === "product" ? lim.productLimit : lim.rfqLimit;
  if (limit === null) return;
  const used =
    kind === "product"
      ? await db.product.count({ where: { orgId, isActive: true } })
      : await db.rfq.count({ where: { buyerOrgId: orgId, createdAt: { gte: new Date(Date.now() - 30 * 864e5) } } });
  if (used < limit) return;
  const lapsedNote = lim.lapsed ? " Your paid plan has ended, so Free limits apply. Renew to restore your plan." : " Upgrade to add more.";
  throw new AppError(
    kind === "product"
      ? `Your ${lim.planName} plan allows ${limit} active products.${lapsedNote}`
      : `Your ${lim.planName} plan allows ${limit} RFQs per 30 days.${lapsedNote}`,
    "FORBIDDEN",
  );
}

export async function getBilling(ctx: Ctx) {
  const [sub, plans, products, rfqs, requests] = await Promise.all([
    db.subscription.findUnique({ where: { orgId: ctx.orgId } }),
    plansOf(),
    db.product.count({ where: { orgId: ctx.orgId, isActive: true } }),
    db.rfq.count({ where: { buyerOrgId: ctx.orgId, createdAt: { gte: new Date(Date.now() - 30 * 864e5) } } }),
    db.planRequest.findMany({ where: { orgId: ctx.orgId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  return {
    limits: effectiveLimits(sub, plans),
    subscription: sub ? { planCode: sub.planCode, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null,
    plans: plans.filter((p) => p.isActive),
    usage: { products, rfqs },
    requests,
  };
}

const requestSchema = z.object({
  planCode: z.string().min(1, "Choose a plan"),
  note: z.string().trim().max(500).optional().default(""),
});

export async function requestPlan(ctx: Ctx, raw: unknown) {
  assertCan(ctx, "org.manage");
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError("Choose a plan.", "VALIDATION", { planCode: parsed.error.issues[0].message });
  const d = parsed.data;
  const plans = await plansOf();
  if (!requestablePlan(d.planCode, plans.filter((p) => p.isActive)))
    throw new AppError("That plan is not available.", "VALIDATION", { planCode: "Choose a paid plan from the list." });

  const req = await db.$transaction(
    async (tx) => {
      const open = await tx.planRequest.count({ where: { orgId: ctx.orgId, status: "PENDING" } });
      if (open) throw new AppError("You already have a plan request waiting for review.", "CONFLICT");
      return tx.planRequest.create({
        data: { orgId: ctx.orgId, requestedById: ctx.userId, planCode: d.planCode, note: d.note || null },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  await audit({ orgId: ctx.orgId, actorId: ctx.userId, action: "plan.requested", entity: "PlanRequest", entityId: req.id, meta: { planCode: d.planCode } });
  return req;
}

// ───────────────────────── admin side ─────────────────────────

export async function listPlanRequests(actor: AdminActor, status: "PENDING" | "APPROVED" | "REJECTED") {
  assertAdmin(actor);
  return db.planRequest.findMany({
    where: { status },
    orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
    take: 100,
    include: {
      org: { select: { id: true, name: true, type: true, city: true, email: true, phone: true, subscription: true } },
      plan: { select: { name: true, priceMonthlyCents: true } },
    },
  });
}

export async function reviewPlanRequest(
  actor: AdminActor,
  id: string,
  decision: "APPROVE" | "REJECT",
  note: string,
  paymentRef: string,
) {
  assertAdmin(actor);
  const reviewNote = note.trim().slice(0, 500);
  const ref = paymentRef.trim().slice(0, 120);
  if (decision === "REJECT" && reviewNote.length < 3)
    throw new AppError("Tell the company why the request was rejected.", "VALIDATION", { note: "Required when rejecting" });
  if (decision === "APPROVE" && ref.length < 2)
    throw new AppError("Record the payment or invoice reference before activating a paid plan.", "VALIDATION", {
      paymentRef: "Required when approving",
    });

  const req = await db.$transaction(
    async (tx) => {
      const r = await tx.planRequest.findUnique({ where: { id } });
      if (!r) throw new AppError("Request not found", "NOT_FOUND");
      // Only one reviewer can move it out of PENDING.
      const flipped = await tx.planRequest.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewNote: reviewNote || null,
          reviewedById: actor.userId,
          reviewedAt: new Date(),
        },
      });
      if (flipped.count !== 1) throw new AppError("This request was already reviewed.", "CONFLICT");
      if (decision === "APPROVE") {
        const current = await tx.subscription.findUnique({ where: { orgId: r.orgId } });
        const end = nextPeriodEnd(current && current.planCode === r.planCode ? current.currentPeriodEnd : null);
        await tx.subscription.upsert({
          where: { orgId: r.orgId },
          create: { orgId: r.orgId, planCode: r.planCode, status: "ACTIVE", provider: "MANUAL", providerRef: ref, currentPeriodEnd: end },
          update: { planCode: r.planCode, status: "ACTIVE", provider: "MANUAL", providerRef: ref, currentPeriodEnd: end },
        });
      }
      return r;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  await audit({
    orgId: req.orgId,
    actorId: actor.userId,
    action: decision === "APPROVE" ? "plan.approved" : "plan.rejected",
    entity: "PlanRequest",
    entityId: id,
    meta: { planCode: req.planCode, paymentRef: decision === "APPROVE" ? ref : undefined },
  });
  await notifyOrg({
    orgId: req.orgId,
    type: "plan.review",
    title: decision === "APPROVE" ? `Your ${req.planCode} plan is active` : "Your plan request was not approved",
    body: reviewNote || undefined,
    href: "/dashboard/billing",
  });
}
