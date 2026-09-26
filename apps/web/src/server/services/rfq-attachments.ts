import { randomBytes } from "node:crypto";
import { db, Prisma } from "@bmn/database";
import { assertBuyer, assertCan, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { audit } from "./notify";
import { deletePrivate, getPrivate, putPrivate } from "../private-storage";
import { MAX_ATTACHMENTS_PER_RFQ, validateAttachment } from "@/lib/attachments";

const columns = {
  id: true,
  filename: true,
  contentType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

/** The buyer that owns the RFQ, or a supplier it was sent to, may see its files. */
async function canAccess(ctx: Ctx, rfqId: string): Promise<boolean> {
  if (ctx.orgType === "SUPPLIER") {
    const r = await db.rfqRecipient.findUnique({
      where: { rfqId_supplierOrgId: { rfqId, supplierOrgId: ctx.orgId } },
      select: { id: true },
    });
    return !!r;
  }
  const rfq = await db.rfq.findFirst({ where: { id: rfqId, buyerOrgId: ctx.orgId }, select: { id: true } });
  return !!rfq;
}

export async function listAttachments(ctx: Ctx, rfqId: string) {
  if (!(await canAccess(ctx, rfqId))) return [];
  return db.rfqAttachment.findMany({
    where: { rfqId },
    orderBy: { createdAt: "asc" },
    select: columns,
  });
}

export async function addAttachment(
  ctx: Ctx,
  rfqId: string,
  file: { name: string; bytes: Uint8Array },
) {
  assertBuyer(ctx);
  assertCan(ctx, "rfq.create");
  const rfq = await db.rfq.findFirst({
    where: { id: rfqId, buyerOrgId: ctx.orgId },
    select: { id: true, status: true },
  });
  if (!rfq) throw new AppError("RFQ not found", "NOT_FOUND");
  if (rfq.status !== "OPEN")
    throw new AppError("Files can only be added while the RFQ is open.", "CONFLICT");

  const check = validateAttachment(file.name, file.bytes);
  if (!check.ok) throw new AppError(check.error, "VALIDATION");

  const storageKey = `rfq/${rfqId}/${randomBytes(12).toString("hex")}.${check.ext}`;
  // Reserve the slot first (Serializable, so two concurrent uploads cannot exceed the cap),
  // then store the object; if storing fails the reservation is rolled back.
  const row = await db.$transaction(
    async (tx) => {
      const count = await tx.rfqAttachment.count({ where: { rfqId } });
      if (count >= MAX_ATTACHMENTS_PER_RFQ)
        throw new AppError(`An RFQ can have at most ${MAX_ATTACHMENTS_PER_RFQ} files.`, "CONFLICT");
      return tx.rfqAttachment.create({
        data: {
          rfqId,
          uploadedById: ctx.userId,
          filename: check.filename,
          contentType: check.contentType,
          sizeBytes: file.bytes.length,
          storageKey,
        },
        select: columns,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  try {
    await putPrivate(storageKey, Buffer.from(file.bytes), check.contentType);
  } catch (e) {
    await db.rfqAttachment.delete({ where: { id: row.id } }).catch(() => undefined);
    throw new AppError(e instanceof Error ? e.message : "Upload failed", "VALIDATION");
  }
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "rfq.attachment_added",
    entity: "Rfq",
    entityId: rfqId,
    meta: { attachmentId: row.id, filename: row.filename },
  });
  return row;
}

export async function removeAttachment(ctx: Ctx, attachmentId: string) {
  assertBuyer(ctx);
  assertCan(ctx, "rfq.create");
  const att = await db.rfqAttachment.findFirst({
    where: { id: attachmentId, rfq: { buyerOrgId: ctx.orgId } },
    include: { rfq: { select: { id: true, status: true } } },
  });
  if (!att) throw new AppError("File not found", "NOT_FOUND");
  if (att.rfq.status !== "OPEN")
    throw new AppError("Files can only be removed while the RFQ is open.", "CONFLICT");
  await db.rfqAttachment.delete({ where: { id: att.id } });
  await deletePrivate(att.storageKey);
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "rfq.attachment_removed",
    entity: "Rfq",
    entityId: att.rfqId,
    meta: { attachmentId: att.id, filename: att.filename },
  });
}

/** Authorization + bytes for the download route. Returns null when not allowed or missing. */
export async function readAttachment(ctx: Ctx, attachmentId: string) {
  const att = await db.rfqAttachment.findUnique({ where: { id: attachmentId } });
  if (!att || !(await canAccess(ctx, att.rfqId))) return null;
  const buf = await getPrivate(att.storageKey);
  if (!buf) return null;
  return { buf, filename: att.filename, contentType: att.contentType };
}
