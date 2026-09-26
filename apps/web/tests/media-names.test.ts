import { describe, expect, it } from "vitest";
import { parseMediaName, skuCandidates } from "../src/lib/bulk/media-names";

describe("media file names", () => {
  it("reads SKU and photo position", () => {
    expect(parseMediaName("CEM-OPC-50.jpg")).toMatchObject({
      sku: "CEM-OPC-50",
      position: 1,
      kind: "image",
    });
    expect(parseMediaName("CEM-OPC-50_2.PNG")).toMatchObject({ sku: "CEM-OPC-50", position: 2 });
    expect(parseMediaName("CEM-OPC-50 (3).webp")).toMatchObject({ sku: "CEM-OPC-50", position: 3 });
    expect(parseMediaName("folder/sub/AB12.jpeg")).toMatchObject({ sku: "AB12", position: 1 });
  });
  it("reads documents and their type", () => {
    expect(parseMediaName("SKU1_datasheet.pdf")).toMatchObject({
      sku: "SKU1",
      kind: "document",
      docKind: "DATASHEET",
    });
    expect(parseMediaName("SKU1-MSDS.pdf")).toMatchObject({ sku: "SKU1", docKind: "MSDS" });
    expect(parseMediaName("SKU1 certificate.PDF")).toMatchObject({
      sku: "SKU1",
      docKind: "CERTIFICATE",
    });
    expect(parseMediaName("SKU1.pdf")).toMatchObject({ sku: "SKU1", docKind: "DATASHEET" });
  });
  it("ignores unsupported and hidden files", () => {
    expect(parseMediaName("notes.txt")).toBeNull();
    expect(parseMediaName(".DS_Store")).toBeNull();
    expect(parseMediaName("noext")).toBeNull();
  });
  it("offers a dash-number reading as a fallback", () => {
    expect(skuCandidates("CEM-OPC-50-2.jpg")).toEqual([
      { sku: "CEM-OPC-50-2", position: 1 },
      { sku: "CEM-OPC-50", position: 2 },
    ]);
    expect(skuCandidates("A1.jpg")).toEqual([{ sku: "A1", position: 1 }]);
  });
});
