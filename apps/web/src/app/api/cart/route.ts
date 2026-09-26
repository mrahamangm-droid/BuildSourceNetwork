import { NextResponse } from "next/server";
import { getCtx } from "@/server/access";
import { errorResponse } from "@/server/api-errors";
import { hit } from "@/server/rate-limit";
import * as cart from "@/server/services/cart";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: await cart.cartCount(ctx) });
}

/** Cart actions: add, quantity, remove, clear, checkout, reorder (from an order), add-list. */
export async function POST(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    if (!hit(`cart:${ctx.userId}`, 240, 3_600_000).ok)
      return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    switch (b.action) {
      case "add":
        return NextResponse.json(await cart.addToCart(ctx, b));
      case "quantity":
        await cart.setCartQuantity(ctx, b);
        return NextResponse.json({ ok: true });
      case "remove":
        await cart.removeCartItem(ctx, String(b.itemId ?? ""));
        return NextResponse.json({ ok: true });
      case "clear":
        await cart.clearCart(ctx);
        return NextResponse.json({ ok: true });
      case "checkout":
        return NextResponse.json(await cart.checkoutCart(ctx, b));
      case "reorder":
        return NextResponse.json(await cart.reorderToCart(ctx, String(b.orderId ?? "")));
      case "add-list":
        return NextResponse.json(await cart.addListToCart(ctx, String(b.listId ?? "")));
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
