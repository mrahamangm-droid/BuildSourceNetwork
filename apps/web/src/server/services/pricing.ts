import { db } from "@bmn/database";
import { assertCan, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { audit } from "./notify";
import { MAX_BREAKS, validateBreaks } from "@/lib/pricing";

/** Break table for one of the caller's own products (org scoped). */
export async function listBreaks(ctx: Ctx, productId: string) {
  const rows = await db.priceBreak.findMany({
    where: { productId, product: { orgId: ctx.orgId } },
    orderBy: { minQty: "asc" },
  });
  return rows.map((r) => ({ minQty: r.minQty.toString(), price: r.price.toString() }));
}

type RawRow = { minQty: string; price: string };

/**
 * Replaces the whole break table. Rows with both fields empty are ignored, so the form
 * can always submit its fixed number of slots.
 */
export async function saveBreaks(ctx: Ctx, productId: string, raw: RawRow[]) {
  assertCan(ctx, "product.manage");
  const product = await db.product.findFirst({ where: { id: productId, orgId: ctx.orgId } });
  if (!product) throw new AppError("Product not found", "NOT_FOUND");

  const slots = raw.slice(0, MAX_BREAKS + 1);
  const used: { slot: number; minQty: number; price: number }[] = [];
  const fieldErrors: Record<string, string> = {};
  slots.forEach((r, slot) => {
    const q = r.minQty.trim();
    const p = r.price.trim();
    if (!q && !p) return;
    if (!q) fieldErrors[`minQty_${slot}`] = "Enter a quantity.";
    if (!p) fieldErrors[`price_${slot}`] = "Enter a price.";
    if (q && p) used.push({ slot, minQty: Number(q), price: Number(p) });
  });
  if (Object.keys(fieldErrors).length)
    throw new AppError("Please fix the highlighted fields.", "VALIDATION", fieldErrors);

  const { sorted, issues } = validateBreaks(used, {
    price: Number(product.price),
    minOrderQty: Number(product.minOrderQty),
  });
  if (issues.length) {
    const fe: Record<string, string> = {};
    for (const i of issues) {
      const slot = i.row < used.length ? used[i.row].slot : MAX_BREAKS;
      fe[`${i.field === "row" ? "minQty" : i.field}_${slot}`] ??= i.message;
    }
    throw new AppError("Please fix the highlighted fields.", "VALIDATION", fe);
  }

  await db.$transaction([
    db.priceBreak.deleteMany({ where: { productId } }),
    db.priceBreak.createMany({
      data: sorted.map((b) => ({ productId, minQty: b.minQty.toFixed(3), price: b.price.toFixed(2) })),
    }),
  ]);
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "product.price_breaks_saved",
    entity: "Product",
    entityId: productId,
    meta: { count: sorted.length },
  });
  return sorted.length;
}
