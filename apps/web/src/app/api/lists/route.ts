import { NextResponse } from "next/server";
import { getCtx } from "@/server/access";
import { errorResponse } from "@/server/api-errors";
import * as cart from "@/server/services/cart";

export const dynamic = "force-dynamic";

/** GET ?productId=… returns the buyer's lists and which already hold that product. */
export async function GET(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const productId = new URL(req.url).searchParams.get("productId");
    return NextResponse.json({
      lists: productId ? await cart.listsForProduct(ctx, productId) : await cart.listLists(ctx),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** List actions: create, rename, delete, add, update-item, remove-item, from-cart. */
export async function POST(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const listId = String(b.listId ?? "");
    switch (b.action) {
      case "create": {
        const l = await cart.createList(ctx, b);
        if (typeof b.productId === "string") await cart.addToList(ctx, l.id, b);
        return NextResponse.json({ id: l.id });
      }
      case "from-cart":
        return NextResponse.json({ id: (await cart.saveCartAsList(ctx, b)).id });
      case "rename":
        await cart.renameList(ctx, listId, b);
        return NextResponse.json({ ok: true });
      case "delete":
        await cart.deleteList(ctx, listId);
        return NextResponse.json({ ok: true });
      case "add":
        await cart.addToList(ctx, listId, b);
        return NextResponse.json({ ok: true });
      case "update-item":
        await cart.updateListItem(ctx, listId, String(b.itemId ?? ""), b);
        return NextResponse.json({ ok: true });
      case "remove-item":
        await cart.removeListItem(ctx, listId, String(b.itemId ?? ""));
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
