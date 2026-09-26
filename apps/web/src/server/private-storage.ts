import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Private object storage (RFQ attachments). Unlike `storage.ts` these objects are never given a
 * public URL: they are read back only through an authorized route. Supabase Storage is used when
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set — the bucket named by SUPABASE_PRIVATE_BUCKET
 * MUST be created as a private bucket. Otherwise a local folder is used (development only).
 */
const LOCAL_DIR = path.resolve(process.cwd(), ".uploads-private");
const KEY_RE = /^rfq\/[a-z0-9]+\/[a-f0-9]{24}\.[a-z0-9]{2,5}$/;

function remote() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  return { base, key, bucket: process.env.SUPABASE_PRIVATE_BUCKET ?? "private-files" };
}

const assertKey = (k: string) => {
  if (!KEY_RE.test(k)) throw new Error("Invalid storage key");
};

export async function putPrivate(key: string, buf: Buffer, contentType: string): Promise<void> {
  assertKey(key);
  const r = remote();
  if (r) {
    const res = await fetch(`${r.base}/storage/v1/object/${r.bucket}/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${r.key}`,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: new Uint8Array(buf),
    });
    if (!res.ok) throw new Error("Upload failed. Please try again.");
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("File storage is not configured.");
  const file = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
}

export async function getPrivate(key: string): Promise<Buffer | null> {
  assertKey(key);
  const r = remote();
  if (r) {
    const res = await fetch(`${r.base}/storage/v1/object/${r.bucket}/${key}`, {
      headers: { Authorization: `Bearer ${r.key}` },
      cache: "no-store",
    });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }
  try {
    return await readFile(path.join(LOCAL_DIR, key));
  } catch {
    return null;
  }
}

/** Best-effort: a leftover object is harmless, a failed request must not break the caller. */
export async function deletePrivate(key: string): Promise<void> {
  try {
    assertKey(key);
    const r = remote();
    if (r) {
      await fetch(`${r.base}/storage/v1/object/${r.bucket}/${key}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${r.key}` },
      });
      return;
    }
    await unlink(path.join(LOCAL_DIR, key));
  } catch {
    /* ignore */
  }
}
