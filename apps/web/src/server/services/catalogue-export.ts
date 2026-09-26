import { db } from "@bmn/database";
import { assertCan, assertOrgType, type Ctx } from "../ctx";
import { buildXlsx, type Cell } from "@/lib/bulk/xlsx-write";

export const EXPORT_MAX_ROWS = 50_000;
const STOCK_LABEL: Record<string, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  ON_REQUEST: "On request",
};

/**
 * Your current catalogue as a workbook for quick price / stock / MOQ edits. Change the cells, then
 * upload it back with "Update existing only". Only products with a SKU are included, because the
 * SKU is what matches a row to its product. The name column is labelled as a reference so it is
 * never mapped as a column to update.
 */
export async function exportCatalogue(ctx: Ctx) {
  assertCan(ctx, "product.manage");
  assertOrgType(ctx, "SUPPLIER", "STORE");
  const products = await db.product.findMany({
    where: { orgId: ctx.orgId, sku: { not: null } },
    orderBy: { sku: "asc" },
    take: EXPORT_MAX_ROWS,
    select: {
      sku: true,
      name: true,
      price: true,
      wholesalePrice: true,
      contractorPrice: true,
      minOrderQty: true,
      stockStatus: true,
      isActive: true,
    },
  });
  const rows: Cell[][] = [
    [
      "SKU",
      "Reference: Name",
      "Price",
      "Wholesale Price",
      "Contractor Price",
      "Min Order Qty",
      "Availability",
      "Active",
    ],
    ...products.map((p): Cell[] => [
      p.sku,
      p.name,
      Number(p.price),
      p.wholesalePrice == null ? null : Number(p.wholesalePrice),
      p.contractorPrice == null ? null : Number(p.contractorPrice),
      Number(p.minOrderQty),
      STOCK_LABEL[p.stockStatus] ?? p.stockStatus,
      p.isActive ? "Yes" : "No",
    ]),
  ];
  return {
    count: products.length,
    bytes: buildXlsx([
      {
        name: "Products",
        header: true,
        rows,
        widths: [18, 36, 12, 16, 17, 14, 14, 8],
        textColumns: [0],
        requiredColumns: [0],
      },
    ]),
  };
}
