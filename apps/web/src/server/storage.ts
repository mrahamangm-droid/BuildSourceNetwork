import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Object storage behind one interface. Supabase Storage is used when SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY are set (production); otherwise files go to a local folder (dev only).
 */
const ALLOWED: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/png": {
    ext: "png",
    magic: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": {
    ext: "webp",
    magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP",
  },
};
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const LOCAL_DIR = path.resolve(process.cwd(), ".uploads");

export type StoredFile = { url: string; contentType: string; sizeBytes: number };

export function validateImage(contentType: string, buf: Buffer): { ext: string } {
  const rule = ALLOWED[contentType];
  if (!rule) throw new Error("Only PNG, JPEG or WebP images are allowed.");
  if (buf.length === 0 || buf.length > MAX_UPLOAD_BYTES)
    throw new Error("Image must be under 2 MB.");
  if (!rule.magic(buf)) throw new Error("File content does not match its type.");
  return { ext: rule.ext };
}

export async function storeImage(
  orgId: string,
  contentType: string,
  buf: Buffer,
): Promise<StoredFile> {
  const { ext } = validateImage(contentType, buf);
  const key = `${orgId}/${randomBytes(12).toString("hex")}.${ext}`;
  const base = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (base && serviceKey) {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "public-assets";
    const res = await fetch(`${base}/storage/v1/object/${bucket}/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: new Uint8Array(buf),
    });
    if (!res.ok) throw new Error("Upload failed. Please try again.");
    return {
      url: `${base}/storage/v1/object/public/${bucket}/${key}`,
      contentType,
      sizeBytes: buf.length,
    };
  }
  if (process.env.NODE_ENV === "production") throw new Error("File storage is not configured.");
  const file = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
  return { url: `/api/files/${key}`, contentType, sizeBytes: buf.length };
}

export async function readLocalFile(
  key: string,
): Promise<{ buf: Buffer; contentType: string } | null> {
  if (!/^[a-z0-9]+\/[a-f0-9]{24}\.(png|jpg|webp)$/.test(key)) return null;
  try {
    const buf = await readFile(path.join(LOCAL_DIR, key));
    const ext = key.split(".").pop()!;
    return {
      buf,
      contentType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
    };
  } catch {
    return null;
  }
}
