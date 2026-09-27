/**
 * Bulk photos and documents. The browser matches file names to SKUs (matchMedia), uploads each file
 * through /api/upload, then links the uploaded files to products in batches (attachMedia). Only
 * files this organization uploaded can be linked, and only to its own products.
 */
import { z } from "zod";
import { db, Prisma } from "@bmn/database";
import { assertCan, assertOrgType, assertVerified, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { audit } from "./notify";
import {
  parseMediaName,
  skuCandidates,
  type DocKind,
  type MediaKind,
} from "@/lib/bulk/media-names";

export const MAX_IMAGES_PER_PRODUCT = 10;
export const MAX_DOCS_PER_PRODUCT = 10;
export const MATCH_BATCH_MAX = 2000;

function guard(ctx: Ctx) {
  assertCan(ctx, "product.manage");
  assertOrgType(ctx, "SUPPLIER", "STORE");
  assertVerified(ctx);
}

export type MediaMatch = {
  filename: string;
  status: "matched" | "unknown_sku" | "unsupported";
  productId?: string;
  productName?: string;
  sku?: string;
  kind?: MediaKind;
  position?: number;
  docKind?: DocKind;
};

/** Which product does each file belong to? Saves nothing. */
export async function matchMedia(ctx: Ctx, raw: unknown): Promise<MediaMatch[]> {
  guard(ctx);
  const filenames = z.array(z.string().max(300)).min(1).max(MATCH_BATCH_MAX).parse(raw);
  const cands = filenames.map((f) => ({ f, c: skuCandidates(f) }));
  const wanted = [...new Set(cands.flatMap((x) => x.c.map((c) => c.sku.toLowerCase())))];
  const rows = wanted.length
    ? await db.$queryRaw<{ id: string; sku: string; name: string }[]>(Prisma.sql`
        SELECT "id", "sku", "name" FROM "Product"
        WHERE "orgId" = ${ctx.orgId} AND "sku" IS NOT NULL AND lower("sku") = ANY(${wanted}::text[])`)
    : [];
  const bySku = new Map(rows.map((r) => [r.sku.toLowerCase(), r]));
  return cands.map(({ f, c }) => {
    if (!c.length) return { filename: f, status: "unsupported" as const };
    for (const cand of c) {
      const p = bySku.get(cand.sku.toLowerCase());
      if (p) {
        const isDoc = /\.pdf$/i.test(f);
        return {
          filename: f,
          status: "matched" as const,
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          kind: isDoc ? ("document" as const) : ("image" as const),
          position: cand.position,
          docKind: isDoc ? docKindOf(f) : undefined,
        };
      }
    }
    return { filename: f, status: "unknown_sku" as const, sku: c[0]!.sku };
  });
}

function docKindOf(filename: string): DocKind {
  return parseMediaName(filename)?.docKind ?? "DATASHEET";
}

const itemSchema = z.object({
  productId: z.string().min(1).max(60),
  kind: z.enum(["image", "document"]),
  url: z.string().min(1).max(600),
  position: z.number().int().min(1).max(MAX_IMAGES_PER_PRODUCT).default(1),
  name: z.string().max(200).default(""),
  docKind: z.enum(["DATASHEET", "CERTIFICATE", "MSDS", "OTHER"]).default("DATASHEET"),
});
const attachSchema = z.object({
  items: z.array(itemSchema).min(1).max(200),
  /** A photo arriving for a position that already has one replaces it (default) or is skipped. */
  replace: z.boolean().default(true),
});

/** What a successful attach created, so it can be undone later (and any replaced photo restored). */
export type UndoStep = {
  kind: "image" | "document";
  id: string;
  restore?: { url: string; alt: string | null; sortOrder: number };
};
export type AttachResult = { index: number; ok: boolean; message: string; undo?: UndoStep };

export async function attachMedia(ctx: Ctx, raw: unknown): Promise<AttachResult[]> {
  guard(ctx);
  const parsed = attachSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Invalid media request", "VALIDATION");
  const { items, replace } = parsed.data;

  const [products, docs] = await Promise.all([
    db.product.findMany({
      where: { orgId: ctx.orgId, id: { in: [...new Set(items.map((i) => i.productId))] } },
      select: { id: true, name: true },
    }),
    db.document.findMany({
      where: { orgId: ctx.orgId, url: { in: [...new Set(items.map((i) => i.url))] } },
      select: { url: true, kind: true, filename: true, sizeBytes: true },
    }),
  ]);
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const docByUrl = new Map(docs.map((d) => [d.url, d]));
  const results: AttachResult[] = [];

  for (const [index, it] of items.entries()) {
    const fail = (message: string) => results.push({ index, ok: false, message });
    const pname = productName.get(it.productId);
    const file = docByUrl.get(it.url);
    if (!pname) {
      fail("Product not found in your catalogue");
      continue;
    }
    if (!file || file.kind !== (it.kind === "image" ? "IMAGE" : "DOCUMENT")) {
      fail("The uploaded file was not found");
      continue;
    }
    try {
      if (it.kind === "image") {
        const order = it.position - 1;
        const existing = await db.productImage.findMany({
          where: { productId: it.productId },
          select: { id: true, url: true, sortOrder: true },
        });
        if (existing.some((e) => e.url === it.url)) {
          results.push({ index, ok: true, message: "Already attached" });
          continue;
        }
        const clash = existing.find((e) => e.sortOrder === order);
        if (clash && !replace) {
          fail(`Photo ${it.position} already exists`);
          continue;
        }
        if (!clash && existing.length >= MAX_IMAGES_PER_PRODUCT) {
          fail(`A product can have ${MAX_IMAGES_PER_PRODUCT} photos`);
          continue;
        }
        const clashRow = clash
          ? await db.productImage.findUnique({ where: { id: clash.id }, select: { alt: true } })
          : null;
        const made = await db.$transaction(async (tx) => {
          if (clash) await tx.productImage.delete({ where: { id: clash.id } });
          return tx.productImage.create({
            data: { productId: it.productId, url: it.url, alt: pname, sortOrder: order },
            select: { id: true },
          });
        });
        results.push({
          index,
          ok: true,
          message: clash ? "Replaced photo" : "Added photo",
          undo: {
            kind: "image",
            id: made.id,
            ...(clash
              ? {
                  restore: {
                    url: clash.url,
                    alt: clashRow?.alt ?? null,
                    sortOrder: clash.sortOrder,
                  },
                }
              : {}),
          },
        });
      } else {
        const existing = await db.productDocument.findMany({
          where: { productId: it.productId },
          select: { url: true },
        });
        if (existing.some((e) => e.url === it.url)) {
          results.push({ index, ok: true, message: "Already attached" });
          continue;
        }
        if (existing.length >= MAX_DOCS_PER_PRODUCT) {
          fail(`A product can have ${MAX_DOCS_PER_PRODUCT} documents`);
          continue;
        }
        const doc = await db.productDocument.create({
          data: {
            productId: it.productId,
            kind: it.docKind,
            name: (it.name || file.filename).replace(/\.pdf$/i, "").slice(0, 120),
            url: it.url,
            sizeBytes: file.sizeBytes,
          },
          select: { id: true },
        });
        results.push({
          index,
          ok: true,
          message: "Added document",
          undo: { kind: "document", id: doc.id },
        });
      }
    } catch {
      fail("Could not be saved");
    }
  }
  const ok = results.filter((r) => r.ok).length;
  if (ok)
    await audit({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: "product.media_attached",
      entity: "Product",
      entityId: items[0]!.productId,
      meta: { count: ok },
    });
  return results;
}

/** Removes a product document (seller only). */
export async function removeProductDocument(ctx: Ctx, id: string) {
  guard(ctx);
  const doc = await db.productDocument.findFirst({
    where: { id, product: { orgId: ctx.orgId } },
    select: { id: true },
  });
  if (!doc) throw new AppError("Document not found", "NOT_FOUND");
  await db.productDocument.delete({ where: { id } });
}

const undoSchema = z.object({
  steps: z
    .array(
      z.object({
        kind: z.enum(["image", "document"]),
        id: z.string().min(1).max(60),
        restore: z
          .object({
            url: z.string().min(1).max(600),
            alt: z.string().max(300).nullable(),
            sortOrder: z.number().int().min(0).max(MAX_IMAGES_PER_PRODUCT),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(500),
});

/**
 * Reverse a bulk photo/document run: remove what it added and put back any photo it replaced.
 * Only rows on the caller's own products are touched, and running it twice is harmless.
 */
export async function undoMedia(ctx: Ctx, raw: unknown) {
  guard(ctx);
  const parsed = undoSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Invalid undo request", "VALIDATION");
  let removed = 0;
  let restored = 0;
  let missing = 0;
  for (const st of parsed.data.steps) {
    if (st.kind === "document") {
      const r = await db.productDocument.deleteMany({
        where: { id: st.id, product: { orgId: ctx.orgId } },
      });
      if (r.count) removed++;
      else missing++;
      continue;
    }
    const img = await db.productImage.findFirst({
      where: { id: st.id, product: { orgId: ctx.orgId } },
      select: { id: true, productId: true },
    });
    if (!img) {
      missing++;
      continue;
    }
    await db.productImage.delete({ where: { id: img.id } });
    removed++;
    if (st.restore) {
      // The old photo must be one of this company's own uploads, and its slot must still be free.
      const own = await db.document.findFirst({
        where: { orgId: ctx.orgId, url: st.restore.url },
        select: { id: true },
      });
      const taken = await db.productImage.findFirst({
        where: { productId: img.productId, sortOrder: st.restore.sortOrder },
        select: { id: true },
      });
      if (own && !taken) {
        await db.productImage.create({
          data: {
            productId: img.productId,
            url: st.restore.url,
            alt: st.restore.alt,
            sortOrder: st.restore.sortOrder,
          },
        });
        restored++;
      }
    }
  }
  if (removed)
    await audit({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: "product.media_undone",
      entity: "Product",
      entityId: parsed.data.steps[0]!.id,
      meta: { removed, restored },
    });
  return { removed, restored, missing };
}
