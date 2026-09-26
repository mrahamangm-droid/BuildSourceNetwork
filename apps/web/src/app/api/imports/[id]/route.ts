import { NextResponse } from "next/server";
import { getCtx } from "@/server/access";
import {
  cancelImport,
  finishImportUpload,
  getImportDetail,
  getImportProgress,
  stageImportRows,
  startImport,
  startRollback,
  stepImport,
  stepRollback,
  stepValidate,
} from "@/server/services/bulk-import";
import { errorResponse } from "@/server/api-errors";

export const dynamic = "force-dynamic";
// Each step is time-boxed to ~8 seconds; the extra headroom covers slow databases.
export const maxDuration = 60;

type P = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: P) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const id = (await params).id;
    const full = new URL(req.url).searchParams.get("detail") === "1";
    return NextResponse.json(
      full ? await getImportDetail(ctx, id) : await getImportProgress(ctx, id),
    );
  } catch (e) {
    return errorResponse(e);
  }
}

/** One endpoint for every step; the browser drives the job by calling it repeatedly. */
export async function POST(req: Request, { params }: P) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const id = (await params).id;
    const body = (await req.json().catch(() => null)) as
      ({ action?: string } & Record<string, unknown>) | null;
    switch (body?.action) {
      case "rows":
        return NextResponse.json(await stageImportRows(ctx, id, body));
      case "finish":
        return NextResponse.json(await finishImportUpload(ctx, id));
      case "validate":
        return NextResponse.json(await stepValidate(ctx, id));
      case "start":
        return NextResponse.json(await startImport(ctx, id, body));
      case "import":
        return NextResponse.json(await stepImport(ctx, id));
      case "rollback":
        return NextResponse.json(await startRollback(ctx, id));
      case "rollback-step":
        return NextResponse.json(await stepRollback(ctx, id));
      case "cancel":
        return NextResponse.json(await cancelImport(ctx, id));
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
