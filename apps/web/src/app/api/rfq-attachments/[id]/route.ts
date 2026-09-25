import { getCtx } from "@/server/access";
import { readAttachment } from "@/server/services/rfq-attachments";
import { contentDisposition } from "@/lib/attachments";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return new Response("Sign in required", { status: 401 });
  const f = await readAttachment(ctx, (await params).id);
  // Same answer for "missing" and "not yours" so ids cannot be probed.
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.buf), {
    headers: {
      "Content-Type": f.contentType,
      "Content-Disposition": contentDisposition(f.filename),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
