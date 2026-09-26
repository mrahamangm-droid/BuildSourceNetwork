import { beforeAll, describe, expect, it } from "vitest";
import { makeAccount, resetDb } from "./helpers";
import { validateImage } from "../src/server/storage";
import { readXlsx } from "../src/lib/bulk/xlsx-read";

let media: typeof import("@/server/services/product-media");
let exp: typeof import("@/server/services/catalogue-export");
let db: typeof import("@bmn/database").db;

beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
  media = await import("@/server/services/product-media");
  exp = await import("@/server/services/catalogue-export");
});

async function seed(name: string) {
  const s = (await makeAccount("SUPPLIER", { name })).ctx;
  const cat = await db.category.findFirstOrThrow();
  const mk = (sku: string | null, n: string) =>
    db.product.create({
      data: {
        orgId: s.orgId,
        categoryId: cat.id,
        unitCode: "BAG",
        sku,
        name: n,
        slug: n.toLowerCase().replace(/\W+/g, "-"),
        price: 10,
      },
    });
  return { s, mk };
}
const doc = (orgId: string, url: string, kind: "IMAGE" | "DOCUMENT") =>
  db.document.create({
    data: {
      orgId,
      url,
      kind,
      filename: url.split("/").pop()!,
      contentType: kind === "IMAGE" ? "image/jpeg" : "application/pdf",
      sizeBytes: 1234,
    },
  });

describe("bulk media", () => {
  it("matches files to SKUs case-insensitively, including dash photo numbers", async () => {
    const { s, mk } = await seed("Media A");
    await mk("CEM-OPC-50", "Cement");
    await mk("PIPE-20", "Pipe");
    const m = await media.matchMedia(s, [
      "cem-opc-50.jpg",
      "CEM-OPC-50_2.png",
      "CEM-OPC-50_msds.pdf",
      "PIPE-20.jpg",
      "PIPE-20-2.jpg",
      "nope.jpg",
      "readme.txt",
    ]);
    expect(m.map((x) => [x.status, x.position, x.kind, x.docKind])).toEqual([
      ["matched", 1, "image", undefined],
      ["matched", 2, "image", undefined],
      ["matched", 1, "document", "MSDS"],
      ["matched", 1, "image", undefined],
      ["matched", 2, "image", undefined],
      ["unknown_sku", undefined, undefined, undefined],
      ["unsupported", undefined, undefined, undefined],
    ]);
    expect(m[4]!.sku).toBe("PIPE-20");
  });

  it("links only files this org uploaded, replaces or keeps photos, caps counts and is tenant-safe", async () => {
    const { s, mk } = await seed("Media B");
    const other = await seed("Media B2");
    const p = await mk("B-1", "Bee");
    const foreign = await other.mk("B-1", "Foreign");
    await doc(s.orgId, "/u/a.jpg", "IMAGE");
    await doc(s.orgId, "/u/b.jpg", "IMAGE");
    await doc(s.orgId, "/u/sheet.pdf", "DOCUMENT");
    await doc(other.s.orgId, "/u/theirs.jpg", "IMAGE");
    const item = (o: object) => ({
      productId: p.id,
      kind: "image",
      url: "/u/a.jpg",
      position: 1,
      ...o,
    });

    let r = await media.attachMedia(s, { items: [item({})] });
    expect(r[0]).toMatchObject({ ok: true, message: "Added photo" });
    r = await media.attachMedia(s, { items: [item({})] });
    expect(r[0]!.message).toBe("Already attached");
    r = await media.attachMedia(s, { items: [item({ url: "/u/b.jpg" })], replace: false });
    expect(r[0]).toMatchObject({ ok: false });
    r = await media.attachMedia(s, { items: [item({ url: "/u/b.jpg" })] });
    expect(r[0]!.message).toBe("Replaced photo");
    expect(
      (await db.productImage.findMany({ where: { productId: p.id } })).map((i) => i.url),
    ).toEqual(["/u/b.jpg"]);

    // someone else's file, someone else's product, wrong kind
    r = await media.attachMedia(s, {
      items: [
        item({ url: "/u/theirs.jpg", position: 2 }),
        item({ productId: foreign.id }),
        item({ url: "/u/sheet.pdf", position: 3 }),
      ],
    });
    expect(r.map((x) => x.ok)).toEqual([false, false, false]);
    expect(await db.productImage.count({ where: { productId: foreign.id } })).toBe(0);

    r = await media.attachMedia(s, {
      items: [
        {
          productId: p.id,
          kind: "document",
          url: "/u/sheet.pdf",
          name: "Bee datasheet.pdf",
          docKind: "DATASHEET",
        },
      ],
    });
    expect(r[0]!.ok).toBe(true);
    const d = await db.productDocument.findFirstOrThrow({ where: { productId: p.id } });
    expect(d.name).toBe("Bee datasheet");
    expect(d.sizeBytes).toBe(1234);

    const buyer = (await makeAccount("BUYER")).ctx;
    await expect(media.matchMedia(buyer, ["a.jpg"])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(media.removeProductDocument(other.s, d.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await media.removeProductDocument(s, d.id);
    expect(await db.productDocument.count()).toBe(0);
  });

  it("exports the catalogue (SKU products only) as an updatable workbook", async () => {
    const { s, mk } = await seed("Media C");
    await mk("C-1", "Cee");
    await mk(null, "No sku");
    const { count, bytes } = await exp.exportCatalogue(s);
    expect(count).toBe(1);
    const sheet = (await readXlsx(bytes))[0]!;
    expect(sheet.rows[0]).toContain("Reference: Name");
    expect(sheet.rows[1]![0]).toBe("C-1");
  });

  it("accepts PDFs by content, and rejects fakes", () => {
    const pdf = Buffer.from("%PDF-1.4\n...");
    expect(validateImage("application/pdf", pdf).ext).toBe("pdf");
    expect(() => validateImage("application/pdf", Buffer.from("MZ not a pdf"))).toThrow();
    expect(() => validateImage("application/pdf", Buffer.alloc(5 * 1024 * 1024, 0x25))).toThrow();
  });
});
