/**
 * A deliberately small Markdown subset that produces a plain data structure. The renderer turns it
 * into React elements, so no raw HTML is ever injected: any HTML typed by an author is shown as text.
 * Supported: # / ## / ### headings, paragraphs, bullet and numbered lists, > quotes, --- rules,
 * **bold**, *italic*, `code` and [links](https://…) (http, https and site-relative only).
 */
export const MAX_BODY_CHARS = 50_000;

export type Inline =
  | { t: "text"; v: string }
  | { t: "b" | "i" | "code"; v: string }
  | { t: "a"; v: string; href: string; external: boolean };

export type Block =
  | { t: "h2" | "h3" | "p" | "quote"; inline: Inline[] }
  | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "hr" };

/** Only http(s) and single-slash relative URLs. Everything else (javascript:, data:, //host) is refused. */
export function safeHref(raw: string): { href: string; external: boolean } | null {
  const u = raw.trim();
  if (/^https?:\/\/[^\s]+$/i.test(u)) return { href: u, external: true };
  if (/^\/(?!\/)[^\s]*$/.test(u)) return { href: u, external: false };
  return null;
}

const INLINE = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\))/g;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of src.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ t: "text", v: src.slice(last, at) });
    if (m[2] !== undefined) out.push({ t: "b", v: m[2] });
    else if (m[3] !== undefined) out.push({ t: "i", v: m[3] });
    else if (m[4] !== undefined) out.push({ t: "code", v: m[4] });
    else {
      const link = safeHref(m[6]);
      // An unsafe target degrades to its visible text instead of becoming a link.
      out.push(link ? { t: "a", v: m[5], ...link } : { t: "text", v: m[5] });
    }
    last = at + m[0].length;
  }
  if (last < src.length) out.push({ t: "text", v: src.slice(last) });
  return out;
}

export function parseMarkdown(body: string): Block[] {
  const lines = body.slice(0, MAX_BODY_CHARS).replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { t: "ul" | "ol"; items: Inline[][] } | null = null;
  let quote: string[] = [];

  const flush = () => {
    if (para.length) blocks.push({ t: "p", inline: parseInline(para.join(" ")) });
    if (list) blocks.push(list);
    if (quote.length) blocks.push({ t: "quote", inline: parseInline(quote.join(" ")) });
    para = [];
    list = null;
    quote = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ t: h[1].length >= 3 ? "h3" : "h2", inline: parseInline(h[2]) });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flush();
      blocks.push({ t: "hr" });
      continue;
    }
    const ul = /^\s*[-*]\s+(.+)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (list && list.t !== kind) flush();
      else if (!list) flush();
      list ??= { t: kind, items: [] };
      list.items.push(parseInline((ul ?? ol)![1]));
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      if (!quote.length) flush();
      quote.push(q[1]);
      continue;
    }
    if (list || quote.length) flush();
    para.push(line.trim());
  }
  flush();
  return blocks;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const part of input.split(",")) {
    const t = slugify(part).slice(0, 30);
    if (t) seen.add(t);
    if (seen.size === 5) break;
  }
  return [...seen];
}
