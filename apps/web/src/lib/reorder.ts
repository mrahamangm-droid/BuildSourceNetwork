/**
 * Regular materials and reorder. Derived from a buyer's own order history, so nothing extra is
 * stored: the more they buy, the better the list gets.
 */
export type HistoryLine = {
  orderId: string;
  orderedAt: Date;
  supplierOrgId: string;
  supplierName: string;
  name: string;
  productId: string | null;
  quantity: number;
  unitCode: string;
  unitPrice: number;
};
export type RegularMaterial = {
  key: string;
  name: string;
  productId: string | null;
  unitCode: string;
  orders: number;
  lastQuantity: number;
  lastPrice: number;
  lastOrderedAt: Date;
  lastOrderId: string;
  supplierOrgId: string;
  supplierName: string;
};

const keyOf = (l: HistoryLine) =>
  l.productId ? `p:${l.productId}` : `n:${l.name.trim().toLowerCase()}|${l.unitCode}`;

/** Most-frequently bought first; ties go to the most recent. */
export function regularMaterials(lines: HistoryLine[], limit = 8): RegularMaterial[] {
  const map = new Map<string, RegularMaterial & { _orders: Set<string> }>();
  for (const l of lines) {
    const k = keyOf(l);
    const cur = map.get(k);
    if (!cur) {
      map.set(k, {
        key: k,
        name: l.name,
        productId: l.productId,
        unitCode: l.unitCode,
        orders: 1,
        lastQuantity: l.quantity,
        lastPrice: l.unitPrice,
        lastOrderedAt: l.orderedAt,
        lastOrderId: l.orderId,
        supplierOrgId: l.supplierOrgId,
        supplierName: l.supplierName,
        _orders: new Set([l.orderId]),
      });
      continue;
    }
    cur._orders.add(l.orderId);
    cur.orders = cur._orders.size;
    if (l.orderedAt > cur.lastOrderedAt) {
      cur.lastOrderedAt = l.orderedAt;
      cur.lastQuantity = l.quantity;
      cur.lastPrice = l.unitPrice;
      cur.lastOrderId = l.orderId;
      cur.supplierOrgId = l.supplierOrgId;
      cur.supplierName = l.supplierName;
      cur.name = l.name;
    }
  }
  return [...map.values()]
    .map((m) => {
      const { _orders: _ignored, ...rest } = m;
      void _ignored;
      return rest;
    })
    .sort((a, b) => b.orders - a.orders || +b.lastOrderedAt - +a.lastOrderedAt)
    .slice(0, limit);
}

export type ReorderItem = {
  name: string;
  categoryId: string;
  productId: string;
  quantity: string;
  unitCode: string;
  specification: string;
};

/** Order lines -> RFQ form lines. Category is filled in later from the product, if it still exists. */
export function toRfqItems(
  lines: { name: string; productId: string | null; quantity: number; unitCode: string }[],
  categoryByProduct: Map<string, string> = new Map(),
): ReorderItem[] {
  return lines.slice(0, 30).map((l) => ({
    name: l.name,
    categoryId: (l.productId && categoryByProduct.get(l.productId)) || "",
    productId: l.productId ?? "",
    quantity: String(l.quantity),
    unitCode: l.unitCode,
    specification: "",
  }));
}
