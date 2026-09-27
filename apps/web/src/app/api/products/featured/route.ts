import { NextResponse } from "next/server";
import { getCtx } from "@/server/access";
import { errorResponse } from "@/server/api-errors";
import { setFeatured } from "@/server/services/storefront";

export const dynamic = "force-dynamic";

/** Feature or unfeature one of the company's products on its storefront. */
export async function POST(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const b = (await req.json().catch(() => ({}))) as { productId?: unknown; on?: unknown };
    await setFeatured(ctx, String(b.productId ?? ""), b.on === true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
