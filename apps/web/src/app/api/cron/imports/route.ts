import { NextResponse } from "next/server";
import { maintainImports } from "@/server/services/bulk-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Resumes imports whose browser tab was closed, and clears old staging data. CRON_SECRET protected. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json({ ok: true, ...(await maintainImports()) });
}
