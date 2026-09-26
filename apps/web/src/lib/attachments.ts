/** Pure validation for private RFQ attachments (drawings, specs, BOQ sheets). */

export const MAX_ATTACHMENTS_PER_RFQ = 5;
/** Kept under Vercel's 4.5 MB request-body limit for serverless functions. */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

type Rule = { contentType: string; magic: (b: Uint8Array) => boolean };

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

const RULES: Record<string, Rule> = {
  pdf: { contentType: "application/pdf", magic: (b) => startsWith(b, ascii("%PDF-")) },
  png: {
    contentType: "image/png",
    magic: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  jpg: { contentType: "image/jpeg", magic: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  jpeg: { contentType: "image/jpeg", magic: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  // Office Open XML files are ZIP containers.
  xlsx: {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    magic: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]),
  },
  docx: {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    magic: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]),
  },
  // AutoCAD drawings start with the version tag AC10xx.
  dwg: { contentType: "application/acad", magic: (b) => startsWith(b, ascii("AC10")) },
};

export const ALLOWED_EXTENSIONS = Object.keys(RULES);

export function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i < 0 ? "" : filename.slice(i + 1).toLowerCase();
}

/** Strip path parts and control characters; keep it short and never empty. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").trim();
  const t = cleaned.replace(/^\.+/, "");
  if (!t) return "file";
  if (t.length <= 120) return t;
  const ext = extensionOf(t);
  return t.slice(0, 110 - ext.length) + (ext ? `.${ext}` : "");
}

export type AttachmentCheck =
  | { ok: true; filename: string; ext: string; contentType: string }
  | { ok: false; error: string };

/** Extension decides the type (browsers report DWG etc. inconsistently); magic bytes must agree. */
export function validateAttachment(filename: string, bytes: Uint8Array): AttachmentCheck {
  const name = safeFilename(filename);
  const ext = extensionOf(name);
  const rule = RULES[ext];
  if (!rule)
    return {
      ok: false,
      error: `Allowed file types: ${ALLOWED_EXTENSIONS.join(", ").toUpperCase()}.`,
    };
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > MAX_ATTACHMENT_BYTES)
    return { ok: false, error: "Each file must be under 4 MB." };
  if (!rule.magic(bytes)) return { ok: false, error: "File content does not match its type." };
  return { ok: true, filename: name, ext, contentType: rule.contentType };
}

/** Safe Content-Disposition value with an ASCII fallback plus RFC 5987 filename*. */
export function contentDisposition(filename: string): string {
  const name = safeFilename(filename);
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/[";\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
