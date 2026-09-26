import { describe, expect, it } from "vitest";
import { parseFlexibleNumber as n } from "../src/lib/bulk/number";
import { decodeText, detectDelimiter, parseCsv, toCsv } from "../src/lib/bulk/csv";

const v = (x: Parameters<typeof n>[0], o?: Parameters<typeof n>[1]) => {
  const r = n(x, o);
  return r == null ? null : "value" in r ? r.value : "ERR";
};

describe("parseFlexibleNumber", () => {
  it("handles common formats", () => {
    expect(v("1,250.50")).toBe(1250.5);
    expect(v("1.250,50")).toBe(1250.5);
    expect(v("AED 12")).toBe(12);
    expect(v("$1,000")).toBe(1000);
    expect(v("1 200 000")).toBe(1200000);
    expect(v("1,00,000")).toBe(100000);
    expect(v("12,5")).toBe(12.5);
    expect(v("1.250.000")).toBe(1250000);
    expect(v("٣٤٥")).toBe(345);
    expect(v(42)).toBe(42);
    expect(v("15%")).toBe(15);
  });
  it("suffixes only when allowed", () => {
    expect(v("2.5k", { allowSuffix: true })).toBe(2500);
    expect(v("1.2M", { allowSuffix: true })).toBe(1200000);
    expect(v("2.5k")).toBe("ERR");
  });
  it("rejects junk and negatives, null for empty", () => {
    expect(v("")).toBeNull();
    expect(v(null)).toBeNull();
    expect(v("abc")).toBe("ERR");
    expect(v("-5")).toBe("ERR");
    expect(v("1.2.3")).toBe("ERR");
  });
});

describe("csv", () => {
  it("parses quotes, escaped quotes and newlines", () => {
    const g = parseCsv('a,b,c\n"x, y","he said ""hi""","l1\nl2"\n');
    expect(g).toEqual([
      ["a", "b", "c"],
      ["x, y", 'he said "hi"', "l1\nl2"],
    ]);
  });
  it("detects delimiters", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(parseCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("handles CRLF and no trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("decodes utf-8 with BOM and falls back to windows-1252", () => {
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]))).toBe("a");
    expect(decodeText(new Uint8Array([0x63, 0x61, 0x66, 0xe9]))).toBe("café");
  });
  it("writes csv with quoting and guards formulas", () => {
    const out = toCsv([
      ["a", "b,c", "=SUM(A1)"],
      ["x\ny", '"q"', 1 as unknown as string],
    ]);
    const back = parseCsv(out);
    expect(back[0]![1]).toBe("b,c");
    expect(back[0]![2]!.startsWith("'")).toBe(true);
    expect(back[1]![0]).toBe("x\ny");
    expect(back[1]![1]).toBe('"q"');
  });
});
