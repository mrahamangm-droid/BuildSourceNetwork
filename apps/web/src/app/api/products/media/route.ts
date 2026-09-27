import { NextResponse } from "next/server";
import { getCtx } from "@/server/access";
import { errorResponse } from "@/server/api-errors";
import { attachMedia, matchMedia, undoMedia } from "@/server/services/product-media";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Bulk photos and documents: match file names to SKUs, then link uploaded files to products. */
export async function POST(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => null)) as
      ({ action?: string; filenames?: unknown } & Record<string, unknown>) | null;
    if (body?.action === "match") return NextResponse.json(await matchMedia(ctx, body.filenames));
    if (body?.action === "attach") return NextResponse.json(await attachMedia(ctx, body));
    if (body?.action === "undo") return NextResponse.json(await undoMedia(ctx, body));
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
