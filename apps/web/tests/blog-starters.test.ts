import { describe, expect, it } from "vitest";
import { STARTER_POSTS } from "../src/lib/blog-starters";
import { parseMarkdown, slugify } from "../src/lib/markdown";
import { postSchema } from "../src/lib/blog";

describe("starter articles", () => {
  it("have unique, url-safe slugs that match their own slugify rule", () => {
    const slugs = STARTER_POSTS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const s of slugs) expect(slugify(s)).toBe(s);
  });
  it("pass the same validation the editor applies", () => {
    for (const s of STARTER_POSTS)
      expect(postSchema.safeParse({ ...s, tags: s.tags.join(",") }).success, s.slug).toBe(true);
  });
  it("parse into headings and paragraphs with no links", () => {
    for (const s of STARTER_POSTS) {
      const blocks = parseMarkdown(s.body);
      expect(blocks.some((b) => b.t === "h2")).toBe(true);
      expect(JSON.stringify(blocks)).not.toContain('"t":"a"');
    }
  });
});
