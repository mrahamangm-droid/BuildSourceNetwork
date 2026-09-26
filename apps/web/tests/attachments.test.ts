import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_BYTES,
  contentDisposition,
  safeFilename,
  validateAttachment,
} from "../src/lib/attachments";

const bytes = (...v: number[]) => new Uint8Array([...v, 0, 0, 0, 0]);
const pdf = new TextEncoder().encode("%PDF-1.7 rest");

describe("validateAttachment", () => {
  it("accepts a real PDF", () => {
    const r = validateAttachment("Plan.PDF", pdf);
    expect(r).toMatchObject({ ok: true, ext: "pdf", contentType: "application/pdf" });
  });
  it("rejects a PDF-named file with other content", () => {
    expect(validateAttachment("a.pdf", bytes(0x4d, 0x5a)).ok).toBe(false); // MZ executable
  });
  it("rejects disallowed extensions even with valid magic", () => {
    expect(validateAttachment("run.exe", pdf).ok).toBe(false);
    expect(validateAttachment("page.html", pdf).ok).toBe(false);
    expect(validateAttachment("noext", pdf).ok).toBe(false);
  });
  it("checks png, jpg, zip-based office files and dwg signatures", () => {
    expect(validateAttachment("a.png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)).ok).toBe(true);
    expect(validateAttachment("a.jpg", bytes(0xff, 0xd8, 0xff)).ok).toBe(true);
    expect(validateAttachment("a.xlsx", bytes(0x50, 0x4b, 0x03, 0x04)).ok).toBe(true);
    expect(validateAttachment("a.dwg", new TextEncoder().encode("AC1027....")).ok).toBe(true);
    expect(validateAttachment("a.png", bytes(0xff, 0xd8, 0xff)).ok).toBe(false);
  });
  it("rejects empty and oversized files", () => {
    expect(validateAttachment("a.pdf", new Uint8Array()).ok).toBe(false);
    const big = new Uint8Array(MAX_ATTACHMENT_BYTES + 1);
    big.set(pdf);
    expect(validateAttachment("a.pdf", big).ok).toBe(false);
  });
});

describe("safeFilename / contentDisposition", () => {
  it("removes paths, control and reserved characters", () => {
    expect(safeFilename("../../etc/pass\u0000wd.pdf")).toBe("passwd.pdf");
    expect(safeFilename('a"b<c>.pdf')).toBe("abc.pdf");
    expect(safeFilename("...")).toBe("file");
    expect(safeFilename("")).toBe("file");
  });
  it("caps length and keeps the extension", () => {
    const n = safeFilename("x".repeat(300) + ".pdf");
    expect(n.length).toBeLessThanOrEqual(120);
    expect(n.endsWith(".pdf")).toBe(true);
  });
  it("builds a header that cannot break out of the quoted value", () => {
    const h = contentDisposition('evil"; x=y.pdf');
    expect(h.startsWith("attachment;")).toBe(true);
    expect(h.match(/"/g)).toHaveLength(2);
    expect(contentDisposition("plán ü.pdf")).toContain("filename*=UTF-8''pl%C3%A1n%20%C3%BC.pdf");
  });
});
