/**
 * Bulk photo and document upload matches files to products by SKU using the file name.
 * "CEM-OPC-50.jpg" is the main photo of SKU CEM-OPC-50; "CEM-OPC-50_2.jpg", "CEM-OPC-50-2.png" and
 * "CEM-OPC-50 (2).jpg" are its further photos. PDFs become documents; a suffix such as
 * "_datasheet", "_msds" or "_certificate" sets the document type.
 */
export type MediaKind = "image" | "document";
export type DocKind = "DATASHEET" | "CERTIFICATE" | "MSDS" | "OTHER";

export type ParsedMediaName = {
  /** The SKU the file claims to belong to (as written). */
  sku: string;
  kind: MediaKind;
  /** 1 = main photo. Documents always 1. */
  position: number;
  docKind: DocKind;
  ext: string;
};

const IMAGE_EXT = /^(jpe?g|png|webp)$/;
const DOC_WORDS: [RegExp, DocKind][] = [
  [/(?:^|[\s_\-.])(msds|sds|safety)$/i, "MSDS"],
  [/(?:^|[\s_\-.])(cert|certificate|test[\s_\-]?report|approval)$/i, "CERTIFICATE"],
  [/(?:^|[\s_\-.])(datasheet|data[\s_\-]?sheet|tds|spec|specs|brochure)$/i, "DATASHEET"],
];

export function parseMediaName(filename: string): ParsedMediaName | null {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const m = /^(.*)\.([A-Za-z0-9]+)$/.exec(base);
  if (!m) return null;
  let stem = m[1]!.trim();
  const ext = m[2]!.toLowerCase();
  const isImage = IMAGE_EXT.test(ext);
  if (!isImage && ext !== "pdf") return null;
  if (!stem || stem.startsWith(".") || stem.startsWith("__MACOSX")) return null;
  if (isImage) {
    let position = 1;
    const paren = /^(.*?)\s*\((\d{1,2})\)$/.exec(stem);
    const suffix = /^(.*?)_(\d{1,2})$/.exec(stem);
    if (paren) {
      stem = paren[1]!.trim();
      position = Number(paren[2]);
    } else if (suffix && suffix[1]) {
      // Only "_2" and "(2)" count as photo numbers here, because SKUs often end in "-50". A "-2"
      // reading is offered as a fallback by skuCandidates when the SKU is otherwise unknown.
      stem = suffix[1];
      position = Number(suffix[2]);
    }
    return { sku: stem, kind: "image", position: Math.max(1, position), docKind: "OTHER", ext };
  }
  let docKind: DocKind = "DATASHEET";
  for (const [re, k] of DOC_WORDS) {
    const hit = re.exec(stem);
    if (hit) {
      docKind = k;
      stem = stem.slice(0, hit.index).replace(/[\s_\-.]+$/, "");
      break;
    }
  }
  if (!stem) return null;
  return { sku: stem, kind: "document", position: 1, docKind, ext };
}

/** Readings of a name, most likely first. The service uses the first one that matches a SKU. */
export function skuCandidates(filename: string): { sku: string; position: number }[] {
  const p = parseMediaName(filename);
  if (!p) return [];
  const out = [{ sku: p.sku, position: p.position }];
  if (p.kind === "image") {
    const whole = (filename.split(/[\\/]/).pop() ?? "").replace(/\.[^.]+$/, "").trim();
    const dash = /^(.+?)[\-.](\d{1,2})$/.exec(whole);
    if (dash && p.position === 1 && dash[1] !== p.sku)
      out.push({ sku: dash[1]!, position: Number(dash[2]) });
  }
  return out;
}
