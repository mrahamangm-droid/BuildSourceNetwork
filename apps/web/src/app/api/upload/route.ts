import { NextResponse } from "next/server";
import { getCtx } from "@/server/access";
import { storeFile, MAX_UPLOAD_BYTES, MAX_DOCUMENT_BYTES } from "@/server/storage";
import { hit } from "@/server/rate-limit";
import { db } from "@bmn/database";

export async function POST(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  // Sellers loading a whole catalogue of photos need far more than the casual limit.
  const seller = ctx.orgType === "SUPPLIER" || ctx.orgType === "STORE";
  if (!hit(`upload:${ctx.userId}`, seller ? 1500 : 30, 60 * 60_000).ok)
    return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const isPdf = file.type === "application/pdf";
  if (isPdf && file.size > MAX_DOCUMENT_BYTES)
    return NextResponse.json({ error: "PDF must be under 4 MB." }, { status: 413 });
  if (!isPdf && file.size > MAX_UPLOAD_BYTES)
    return NextResponse.json({ error: "Image must be under 2 MB." }, { status: 413 });
  try {
    const stored = await storeFile(ctx.orgId, file.type, Buffer.from(await file.arrayBuffer()));
    await db.document.create({
      data: {
        orgId: ctx.orgId,
        kind: isPdf ? "DOCUMENT" : "IMAGE",
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
