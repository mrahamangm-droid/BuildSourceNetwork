import { describe, expect, it } from "vitest";
import {
  parseInline,
  parseMarkdown,
  parseTags,
  readingMinutes,
  safeHref,
  slugify,
} from "../src/lib/markdown";

describe("safeHref", () => {
  it("allows http(s) and site-relative links", () => {
    expect(safeHref("https://example.com/a?b=1")).toEqual({
      href: "https://example.com/a?b=1",
      external: true,
    });
    expect(safeHref("/suppliers")).toEqual({ href: "/suppliers", external: false });
  });
  it("refuses script, data, protocol-relative and bare values", () => {
    for (const u of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,x",
      "//evil.com",
      "mailto:a@b.c",
      "example.com",
      "vbscript:x",
    ])
      expect(safeHref(u)).toBeNull();
  });
});

describe("parseInline", () => {
  it("parses bold, italic, code and links", () => {
    const r = parseInline("a **b** *c* `d` [e](/f)");
    expect(r.map((x) => x.t)).toEqual(["text", "b", "text", "i", "text", "code", "text", "a"]);
  });
  it("turns an unsafe link into plain text, never an anchor", () => {
    const r = parseInline("[click](javascript:alert(1))");
    expect(r).toEqual([{ t: "text", v: "click" }]);
  });
  it("keeps raw HTML as literal text", () => {
    const r = parseInline("<script>alert(1)</script> <img src=x onerror=y>");
    expect(r.every((x) => x.t === "text")).toBe(true);
    expect(r.map((x) => x.v).join("")).toContain("<script>");
  });
});

describe("parseMarkdown", () => {
  it("builds headings, paragraphs and lists", () => {
    const b = parseMarkdown(
      "# Title\n\nHello\nworld\n\n- one\n- two\n\n1. a\n2) b\n\n> quote\n\n---",
    );
    expect(b.map((x) => x.t)).toEqual(["h2", "p", "ul", "ol", "quote", "hr"]);
    const p = b[1];
    expect(p.t === "p" && p.inline[0]).toEqual({ t: "text", v: "Hello world" });
    expect(b[2].t === "ul" && b[2].items).toHaveLength(2);
  });
  it("maps deeper headings to h3 and keeps lists of different kinds separate", () => {
    const b = parseMarkdown("### Small\n- x\n1. y");
    expect(b.map((x) => x.t)).toEqual(["h3", "ul", "ol"]);
  });
  it("handles CRLF and empty input", () => {
    expect(parseMarkdown("a\r\n\r\nb")).toHaveLength(2);
    expect(parseMarkdown("")).toEqual([]);
  });
});

describe("slugify / tags / reading time", () => {
  it("makes url-safe slugs", () => {
    expect(slugify("  How to write an RFQ — fast! ")).toBe("how-to-write-an-rfq-fast");
    expect(slugify("Café Ünï")).toBe("cafe-uni");
    expect(slugify("!!!")).toBe("");
  });
  it("de-duplicates and caps tags", () => {
    expect(parseTags("RFQ, rfq, Buying Tips, a,b,c,d,e")).toEqual([
      "rfq",
      "buying-tips",
      "a",
      "b",
      "c",
    ]);
  });
  it("estimates reading time with a minimum of one minute", () => {
    expect(readingMinutes("word")).toBe(1);
    expect(readingMinutes("w ".repeat(1000))).toBe(5);
  });
});
