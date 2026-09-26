import { NextResponse } from "next/server";
import { getCtx } from "@/server/access";
import { errorResponse } from "@/server/api-errors";
import { exportCatalogue } from "@/server/services/catalogue-export";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Current catalogue as .xlsx for quick price, stock and MOQ edits. */
export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { bytes } = await exportCatalogue(ctx);
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="bsn-catalogue-for-update.xlsx"',
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
