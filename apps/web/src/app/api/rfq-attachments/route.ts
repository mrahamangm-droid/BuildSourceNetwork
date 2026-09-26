import { NextResponse } from "next/server";
import { getCtx } from "@/server/access";
import { hit } from "@/server/rate-limit";
import { addAttachment } from "@/server/services/rfq-attachments";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachments";

export async function POST(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!hit(`rfqatt:${ctx.userId}`, 30, 60 * 60_000).ok)
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const rfqId = form?.get("rfqId");
  if (!(file instanceof File) || typeof rfqId !== "string")
    return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_ATTACHMENT_BYTES)
    return NextResponse.json({ error: "Each file must be under 4 MB." }, { status: 413 });
  try {
    const row = await addAttachment(ctx, rfqId, {
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json({ id: row.id });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    const status = code === "NOT_FOUND" ? 404 : code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status },
    );
  }
}
