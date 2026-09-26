import { NextResponse } from "next/server";
import { getCtx } from "@/server/access";
import { importErrorReport } from "@/server/services/bulk-import";
import { errorResponse } from "@/server/api-errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Downloadable CSV of every rejected row with the original cells and how to fix each one. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const r = await importErrorReport(ctx, (await params).id);
    return new NextResponse(r.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${r.filename.replace(/[^\w.\-]+/g, "_")}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
