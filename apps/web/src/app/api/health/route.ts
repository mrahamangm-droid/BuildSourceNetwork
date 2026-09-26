import { NextResponse } from "next/server";
import { db } from "@bmn/database";
import { checkEnv, hasErrors } from "@/lib/env-check";

export const dynamic = "force-dynamic";

/**
 * Uptime probe. Public callers get only {ok}; a bearer CRON_SECRET adds the
 * environment findings (variable names and messages, never values).
 */
export async function GET(req: Request) {
  let dbOk = true;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }
  const findings = checkEnv(process.env);
  const ok = dbOk && !hasErrors(findings);
  const secret = process.env.CRON_SECRET;
  const detailed = Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
  const body = detailed ? { ok, db: dbOk, env: findings } : { ok };
  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
