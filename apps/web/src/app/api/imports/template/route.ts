import { NextResponse } from "next/server";
import { getCtx } from "@/server/access";
import { productTemplateFile } from "@/server/services/bulk-import";
import { errorResponse } from "@/server/api-errors";

export const dynamic = "force-dynamic";

/** The product workbook with Category, Subcategory, Product Type and Unit drop-downs. */
export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const bytes = await productTemplateFile(ctx);
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="bsn-product-import-template.xlsx"',
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
