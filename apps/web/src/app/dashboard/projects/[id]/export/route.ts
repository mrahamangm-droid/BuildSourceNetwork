import { requireCtx } from "@/server/access";
import { exportCsv } from "@/server/services/projects";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireCtx();
    const { name, csv } = await exportCsv(ctx, (await params).id);
    const safe =
      name
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "project";
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${safe}-boq.csv"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof AppError)
      return new Response(e.message, { status: e.code === "NOT_FOUND" ? 404 : 403 });
    throw e;
  }
}
