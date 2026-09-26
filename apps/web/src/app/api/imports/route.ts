import { NextResponse } from "next/server";
import { getCtx } from "@/server/access";
import { errorResponse } from "@/server/api-errors";
import { createImportJob } from "@/server/services/bulk-import";

export const dynamic = "force-dynamic";

/** Registers an import (file name, header row, column mapping). Rows are sent afterwards in chunks. */
export async function POST(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const id = await createImportJob(ctx, await req.json().catch(() => null));
    return NextResponse.json({ id });
  } catch (e) {
    return errorResponse(e);
  }
}
