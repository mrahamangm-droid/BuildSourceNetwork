import { beforeAll, describe, expect, it } from "vitest";
import { makeAccount, resetDb } from "./helpers";

let projects: typeof import("@/server/services/projects");
let db: typeof import("@bmn/database").db;

let n = 0;
async function makeRfq(buyerOrgId: string, createdById: string, projectId?: string) {
  n += 1;
  return db.rfq.create({
    data: {
      number: `RFQ-LINK-${n}`,
      buyerOrgId,
      createdById,
      deliveryCity: "Dubai",
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
      projectId: projectId ?? null,
    },
  });
}

beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
  projects = await import("@/server/services/projects");
});

describe("linking an existing RFQ to a project", () => {
  it("links, moves and unlinks an RFQ, recording each change", async () => {
    const b = await makeAccount("CONTRACTOR", { name: "Link Buyer" });
    const p1 = await projects.createProject(b.ctx, { name: "Tower A", kind: "WAREHOUSE" });
    const p2 = await projects.createProject(b.ctx, { name: "Villa B", kind: "VILLA" });
    const r = await makeRfq(b.ctx.orgId, b.userId);

    await projects.setRfqProject(b.ctx, r.id, p1.id);
    expect((await db.rfq.findUniqueOrThrow({ where: { id: r.id } })).projectId).toBe(p1.id);
    await projects.setRfqProject(b.ctx, r.id, p2.id);
    expect((await db.rfq.findUniqueOrThrow({ where: { id: r.id } })).projectId).toBe(p2.id);
    await projects.setRfqProject(b.ctx, r.id, null);
    expect((await db.rfq.findUniqueOrThrow({ where: { id: r.id } })).projectId).toBeNull();

    const logs = await db.auditLog.count({
      where: { entityId: r.id, action: { in: ["rfq.project_linked", "rfq.project_unlinked"] } },
    });
    expect(logs).toBe(3);
  });

  it("does nothing (and logs nothing) when the link is unchanged", async () => {
    const b = await makeAccount("CONTRACTOR", { name: "Link Buyer 2" });
    const p = await projects.createProject(b.ctx, { name: "Same", kind: "WAREHOUSE" });
    const r = await makeRfq(b.ctx.orgId, b.userId, p.id);
    await projects.setRfqProject(b.ctx, r.id, p.id);
    expect(await db.auditLog.count({ where: { entityId: r.id } })).toBe(0);
  });

  it("refuses another organization's RFQ or project", async () => {
    const a = await makeAccount("CONTRACTOR", { name: "Link Owner" });
    const other = await makeAccount("CONTRACTOR", { name: "Link Other" });
    const mine = await projects.createProject(a.ctx, { name: "Mine", kind: "WAREHOUSE" });
    const theirs = await projects.createProject(other.ctx, { name: "Theirs", kind: "WAREHOUSE" });
    const r = await makeRfq(a.ctx.orgId, a.userId);
    await expect(projects.setRfqProject(other.ctx, r.id, theirs.id)).rejects.toThrow(/not found/i);
    await expect(projects.setRfqProject(a.ctx, r.id, theirs.id)).rejects.toThrow(/not found/i);
    expect((await db.rfq.findUniqueOrThrow({ where: { id: r.id } })).projectId).toBeNull();
    await projects.setRfqProject(a.ctx, r.id, mine.id);
  });

  it("is limited to buyers", async () => {
    const s = await makeAccount("SUPPLIER", { name: "Link Supplier" });
    await expect(projects.setRfqProject(s.ctx, "x", null)).rejects.toThrow();
  });
});
