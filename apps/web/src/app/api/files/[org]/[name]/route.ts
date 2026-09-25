import { readLocalFile } from "@/server/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ org: string; name: string }> },
) {
  const { org, name } = await params;
  const file = await readLocalFile(`${org}/${name}`);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.buf), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
