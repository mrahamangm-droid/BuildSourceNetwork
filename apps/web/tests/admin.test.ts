import { beforeAll, describe, expect, it } from "vitest";
import { makeAccount, resetDb } from "./helpers";

type Acc = Awaited<ReturnType<typeof makeAccount>>;
let admin: typeof import("@/server/services/admin");
let db: typeof import("@bmn/database").db;
let supplier: Acc;
let staff: Acc;
let adminActor: { userId: string; isPlatformAdmin: boolean };
const input = {
  legalName: "Acme Trading LLC",
  licenseNumber: "TL-12345",
  licenseAuthority: "SEDD",
};

beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
  admin = await import("@/server/services/admin");
  supplier = await makeAccount("SUPPLIER");
  staff = await makeAccount("SUPPLIER");
  await db.organizationMember.update({
    where: { userId_orgId: { userId: staff.userId, orgId: staff.ctx.orgId } },
    data: { role: "STAFF" },
  });
  staff.ctx.role = "STAFF";
  const u = await db.user.create({
    data: { email: "root@test.example", name: "Root", passwordHash: "x", isPlatformAdmin: true },
  });
  adminActor = { userId: u.id, isPlatformAdmin: true };
});

describe("company verification", () => {
  it("validates input and requires org.manage", async () => {
    await expect(admin.submitVerification(supplier.ctx, { legalName: "A" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(admin.submitVerification(staff.ctx, input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("submits once, sets PENDING, blocks duplicates", async () => {
    await admin.submitVerification(supplier.ctx, input);
    expect(
      (await db.organization.findUniqueOrThrow({ where: { id: supplier.ctx.orgId } }))
        .verificationStatus,
    ).toBe("PENDING");
    await expect(admin.submitVerification(supplier.ctx, input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("non-admins cannot review or list", async () => {
    const req = await db.verificationRequest.findFirstOrThrow({
      where: { orgId: supplier.ctx.orgId },
    });
    const notAdmin = { userId: supplier.userId, isPlatformAdmin: false };
    await expect(admin.reviewVerification(notAdmin, req.id, "APPROVE", "")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(admin.listVerificationRequests(notAdmin)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejection needs a reason, then allows re-apply; approval verifies exactly once", async () => {
    const req = await db.verificationRequest.findFirstOrThrow({
      where: { orgId: supplier.ctx.orgId },
    });
    await expect(admin.reviewVerification(adminActor, req.id, "REJECT", "")).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await admin.reviewVerification(adminActor, req.id, "REJECT", "Licence photo unreadable");
    await expect(admin.reviewVerification(adminActor, req.id, "APPROVE", "")).rejects.toMatchObject(
      { code: "CONFLICT" },
    );
    expect(
      (await db.organization.findUniqueOrThrow({ where: { id: supplier.ctx.orgId } }))
        .verificationStatus,
    ).toBe("REJECTED");

    const again = await admin.submitVerification(supplier.ctx, input);
    await admin.reviewVerification(adminActor, again.id, "APPROVE", "");
    expect(
      (await db.organization.findUniqueOrThrow({ where: { id: supplier.ctx.orgId } }))
        .verificationStatus,
    ).toBe("VERIFIED");
    expect(await db.auditLog.count({ where: { action: "verification.approved" } })).toBe(1);
    expect(await db.notification.count({ where: { type: "verification" } })).toBeGreaterThan(0);
  });

  it("revoke returns to UNVERIFIED; demo orgs can never be verified", async () => {
    await admin.revokeVerification(adminActor, supplier.ctx.orgId, "Licence expired");
    expect(
      (await db.organization.findUniqueOrThrow({ where: { id: supplier.ctx.orgId } }))
        .verificationStatus,
    ).toBe("UNVERIFIED");
    const demo = await makeAccount("SUPPLIER");
    await db.organization.update({ where: { id: demo.ctx.orgId }, data: { isDemo: true } });
    await expect(admin.submitVerification(demo.ctx, input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("admin tools", () => {
  it("overview, org list and suspension work; suspended org loses access", async () => {
    const o = await admin.adminOverview(adminActor);
    expect(o.totalOrgs).toBeGreaterThan(0);
    const l = await admin.listOrganizations(adminActor, { q: "Test", type: "SUPPLIER" });
    expect(l.total).toBeGreaterThan(0);
    await admin.setOrgActive(adminActor, staff.ctx.orgId, false);
    const { buildCtx } = await import("@/server/ctx");
    expect(await buildCtx(staff.userId)).toBeNull();
    await admin.setOrgActive(adminActor, staff.ctx.orgId, true);
    expect(await buildCtx(staff.userId)).not.toBeNull();
  });

  it("validates and saves platform settings", async () => {
    await expect(
      admin.updateSettings(adminActor, { platformFeeBps: "-1", rfqExpiryDays: "7" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await admin.updateSettings(adminActor, { platformFeeBps: "150", rfqExpiryDays: "10" });
    const s = await admin.getSettings(adminActor);
    expect(s.find((r) => r.key === "platformFeeBps")?.value).toBe("150");
  });
});
