import { NextResponse } from "next/server";
import { expireStale } from "@/server/services/rfq";

/** Vercel Cron hits this daily (see vercel.json). Protected by CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return new NextResponse("Unauthorized", { status: 401 });
  const expired = await expireStale();
  return NextResponse.json({ ok: true, expired });
}
