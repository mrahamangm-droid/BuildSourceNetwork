import { describe, expect, it } from "vitest";
import { leadTimeLabel, MAX_CERTIFICATIONS, parseCertifications, parseKind, parseLeadTime } from "../src/lib/manufacturer";

describe("parseCertifications", () => {
  it("splits on commas, semicolons and newlines and trims", () => {
    expect(parseCertifications("ISO 9001, ISO 14001 ; CE\nBS 4449")).toEqual(["ISO 9001", "ISO 14001", "CE", "BS 4449"]);
  });
  it("de-duplicates case-insensitively and collapses spaces", () => {
    expect(parseCertifications("ISO  9001, iso 9001,")).toEqual(["ISO 9001"]);
  });
  it("caps the count and length", () => {
    const many = Array.from({ length: 30 }, (_, i) => `C${i}`).join(",");
    expect(parseCertifications(many)).toHaveLength(MAX_CERTIFICATIONS);
    expect(parseCertifications("x".repeat(100))[0]).toHaveLength(40);
  });
  it("returns an empty list for blank input", () => {
    expect(parseCertifications("  , ; ")).toEqual([]);
  });
});

describe("parseLeadTime", () => {
  it("treats blank as not set", () => expect(parseLeadTime(" ")).toBeNull());
  it("accepts 0..365", () => {
    expect(parseLeadTime("0")).toBe(0);
    expect(parseLeadTime("365")).toBe(365);
  });
  it("rejects out of range, decimals and text", () => {
    for (const v of ["366", "-1", "2.5", "abc", "1000"]) expect(parseLeadTime(v)).toBeUndefined();
  });
});

describe("parseKind / leadTimeLabel", () => {
  it("only accepts known kinds", () => {
    expect(parseKind("MANUFACTURER")).toBe("MANUFACTURER");
    expect(parseKind("FACTORY")).toBeNull();
    expect(parseKind("")).toBeNull();
  });
  it("labels lead times", () => {
    expect(leadTimeLabel(null)).toBeNull();
    expect(leadTimeLabel(0)).toBe("Ex-stock");
    expect(leadTimeLabel(1)).toBe("1 day");
    expect(leadTimeLabel(14)).toBe("14 days");
  });
});
