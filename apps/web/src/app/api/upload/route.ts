import { NextResponse } from "next/server";
import { getCtx } from "@/server/access";
import { storeImage, MAX_UPLOAD_BYTES } from "@/server/storage";
import { hit } from "@/server/rate-limit";
import { db } from "@bmn/database";

export async function POST(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!hit(`upload:${ctx.userId}`, 30, 60 * 60_000).ok)
    return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES)
    return NextResponse.json({ error: "Image must be under 2 MB." }, { status: 413 });
  try {
    const stored = await storeImage(ctx.orgId, file.type, Buffer.from(await file.arrayBuffer()));
    await db.document.create({
      data: {
        orgId: ctx.orgId,
        kind: "IMAGE",
        url: stored.url,
        filename: file.name.slice(0, 120),
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
      },
    });
    return NextResponse.json({ url: stored.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}
