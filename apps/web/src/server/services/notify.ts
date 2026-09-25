import { db } from "@bmn/database";
import { sendMail } from "../email";
import { appUrl } from "@/lib/utils";

type N = { orgId: string; type: string; title: string; body?: string; href?: string };

/** In-app notification for every member of an org; email too when the member opted in. */
export async function notifyOrg({ orgId, type, title, body, href }: N) {
  const members = await db.organizationMember.findMany({
    where: { orgId },
    include: { user: { select: { id: true, email: true, notifyInApp: true, notifyEmail: true } } },
  });
  const inApp = members.filter((m) => m.user.notifyInApp);
  if (inApp.length) {
    await db.notification.createMany({
      data: inApp.map((m) => ({ userId: m.user.id, orgId, type, title, body, href })),
    });
  }
  await Promise.all(
    members
      .filter((m) => m.user.notifyEmail)
      .map((m) =>
        sendMail({
          to: m.user.email,
          subject: title,
          text: `${title}\n\n${body ?? ""}\n\n${href ? appUrl() + href : appUrl()}`,
        }).catch((e) => console.error("[notify] email failed", e instanceof Error ? e.message : e)),
      ),
  );
}

export async function audit(p: {
  orgId?: string | null;
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: object;
}) {
  await db.auditLog.create({
    data: {
      orgId: p.orgId ?? null,
      actorId: p.actorId ?? null,
      action: p.action,
      entity: p.entity,
      entityId: p.entityId,
      meta: p.meta,
    },
  });
}
