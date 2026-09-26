import { beforeAll, describe, expect, it } from "vitest";
import { makeAccount, resetDb } from "./helpers";

let cart: typeof import("@/server/services/cart");
let db: typeof import("@bmn/database").db;

beforeAll(async () => {
  await resetDb();
  db = (await import("@bmn/database")).db;
  cart = await import("@/server/services/cart");
});

async function supplier(name: string) {
  const s = (await makeAccount("SUPPLIER", { name })).ctx;
  const cat = await db.category.findFirstOrThrow();
  const mk = (n: string, price: number, extra: Record<string, unknown> = {}) =>
    db.product.create({
      data: {
        orgId: s.orgId,
        categoryId: cat.id,
        unitCode: "BAG",
        name: n,
        slug: n.toLowerCase().replace(/\W+/g, "-"),
        price,
        ...extra,
      },
    });
  return { s, mk };
}

describe("cart", () => {
  it("prices with volume breaks, groups by supplier and checks out one order per supplier", async () => {
    const a = await supplier("Cart Supplier A");
    const b = await supplier("Cart Supplier B");
    const buyer = (await makeAccount("CONTRACTOR")).ctx;
    const cement = await a.mk("Cement 50kg", 20, { minOrderQty: 10 });
    await db.priceBreak.create({ data: { productId: cement.id, minQty: 100, price: 18 } });
    const sand = await b.mk("Sand", 5);
    const out = await b.mk("Out of stock thing", 9, { stockStatus: "OUT_OF_STOCK" });

    // default quantity is the minimum order; adding again accumulates
    await cart.addToCart(buyer, { productId: cement.id });
    await cart.addToCart(buyer, { productId: cement.id, quantity: 90 });
    await cart.addToCart(buyer, { productId: sand.id, quantity: 4 });
    await cart.addToCart(buyer, { productId: out.id, quantity: 1 });

    const c = await cart.getCart(buyer);
    expect(c.groups.map((g) => g.supplierName)).toEqual(["Cart Supplier A", "Cart Supplier B"]);
    const line = c.groups[0]!.lines[0]!;
    expect(line.quantity).toBe(100);
    expect(line.unitPrice).toBe(18); // 100 units reaches the break
    expect(line.lineTotal).toBe(1800);
    expect(c.groups[1]!.orderable).toBe(false); // one line is out of stock
    expect(c.subtotal).toBe(1800 + 20); // 4 x 5 for sand; out-of-stock line excluded

    // an unverified or wrong-account user cannot check out
    await expect(cart.checkoutCart(a.s, { deliveryCity: "Dubai" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(cart.checkoutCart(buyer, {})).rejects.toMatchObject({ code: "VALIDATION" });

    const res = await cart.checkoutCart(buyer, { deliveryCity: "Dubai", notes: "Gate 2" });
    expect(res.orders).toHaveLength(2);
    expect(res.skipped).toEqual([{ name: "Out of stock thing", reason: "Out of stock" }]);
    const orders = await db.order.findMany({
      where: { buyerOrgId: buyer.orgId },
      include: { items: true, events: true },
      orderBy: { subtotal: "desc" },
    });
    expect(orders.map((o) => Number(o.totalAmount))).toEqual([1800, 20]);
    expect(orders[0]!.items[0]).toMatchObject({ name: "Cement 50kg", productId: cement.id });
    expect(orders[0]!.deliveryCity).toBe("Dubai");
    expect(orders[0]!.events[0]!.status).toBe("ORDER_CREATED");
    // ordered lines leave the cart; the unorderable one stays, nothing is lost
    const left = await db.cartItem.findMany({ where: { orgId: buyer.orgId } });
    expect(left.map((l) => l.productId)).toEqual([out.id]);
    expect(await db.notification.count({ where: { orgId: a.s.orgId } })).toBeGreaterThan(0);
  });

  it("guards ownership, minimum order and tenancy", async () => {
    const a = await supplier("Guard Supplier");
    const buyer = (await makeAccount("BUYER")).ctx;
    const other = (await makeAccount("BUYER")).ctx;
    const p = await a.mk("Rebar", 3, { minOrderQty: 5 });
    await expect(cart.addToCart(a.s, { productId: p.id })).rejects.toMatchObject({
      code: "FORBIDDEN", // suppliers are not buyers
    });
    await cart.addToCart(buyer, { productId: p.id, quantity: 2 });
    let c = await cart.getCart(buyer);
    expect(c.groups[0]!.lines[0]!.issue).toBe("Minimum order is 5");
    await expect(cart.checkoutCart(buyer, { deliveryCity: "Dubai" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    const id = c.groups[0]!.lines[0]!.id;
    // another company can neither change nor delete it
    await expect(cart.setCartQuantity(other, { itemId: id, quantity: 9 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await cart.removeCartItem(other, id);
    expect(await db.cartItem.count({ where: { id } })).toBe(1);
    await expect(cart.addToCart(buyer, { productId: p.id, quantity: -1 })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await cart.setCartQuantity(buyer, { itemId: id, quantity: 7.5 });
    c = await cart.getCart(buyer);
    expect(c.groups[0]!.lines[0]!.issue).toBeNull();
    expect(await cart.cartCount(buyer)).toBe(1);
    await cart.clearCart(buyer);
    expect(await cart.cartCount(buyer)).toBe(0);
  });

  it("checks out only the chosen suppliers", async () => {
    const a = await supplier("Pick A");
    const b = await supplier("Pick B");
    const buyer = (await makeAccount("CONTRACTOR")).ctx;
    const pa = await a.mk("Pick item A", 10);
    const pb = await b.mk("Pick item B", 10);
    await cart.addToCart(buyer, { productId: pa.id });
    await cart.addToCart(buyer, { productId: pb.id });
    const r = await cart.checkoutCart(buyer, {
      deliveryCity: "Ajman",
      supplierOrgIds: [a.s.orgId],
    });
    expect(r.orders).toHaveLength(1);
    expect(
      (await db.cartItem.findMany({ where: { orgId: buyer.orgId } })).map((x) => x.productId),
    ).toEqual([pb.id]);
  });
});

describe("saved lists and reorder", () => {
  it("creates lists, moves them to the cart, and reorders a past order", async () => {
    const a = await supplier("List Supplier");
    const buyer = (await makeAccount("CONTRACTOR")).ctx;
    const other = (await makeAccount("CONTRACTOR")).ctx;
    const p1 = await a.mk("List item 1", 10, { minOrderQty: 2 });
    const p2 = await a.mk("List item 2", 20);

    const list = await cart.createList(buyer, { name: "Villa 12" });
    await expect(cart.createList(buyer, { name: "Villa 12" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await cart.addToList(buyer, list.id, { productId: p1.id }); // defaults to MOQ
    await cart.addToList(buyer, list.id, { productId: p2.id, quantity: 6 });
    await cart.addToList(buyer, list.id, { productId: p2.id, quantity: 8 }); // updates, not duplicates
    const got = (await cart.getList(buyer, list.id))!;
    expect(got.items.map((i) => [i.name, i.quantity])).toEqual([
      ["List item 1", 2],
      ["List item 2", 8],
    ]);
    expect(await cart.getList(other, list.id)).toBeNull();
    await expect(cart.addToList(other, list.id, { productId: p1.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await cart.listsForProduct(buyer, p1.id))[0]).toMatchObject({
      name: "Villa 12",
      has: true,
    });

    const moved = await cart.addListToCart(buyer, list.id);
    expect(moved).toEqual({ added: 2, skipped: [] });
    expect(await cart.cartCount(buyer)).toBe(2);

    // save the cart as a new list; reorder from the resulting order
    await cart.saveCartAsList(buyer, { name: "Weekly" });
    expect((await cart.listLists(buyer)).map((l) => l.name).sort()).toEqual(["Villa 12", "Weekly"]);
    await cart.checkoutCart(buyer, { deliveryCity: "Dubai" });
    expect(await cart.cartCount(buyer)).toBe(0);
    const order = await db.order.findFirstOrThrow({ where: { buyerOrgId: buyer.orgId } });
    await db.product.update({ where: { id: p2.id }, data: { isActive: false } });
    const re = await cart.reorderToCart(buyer, order.id);
    expect(re.added).toBe(1);
    expect(re.skipped).toEqual([{ name: "List item 2", reason: "No longer available" }]);
    await expect(cart.reorderToCart(other, order.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    await cart.updateListItem(buyer, list.id, got.items[0]!.id, { quantity: 5, note: "grey" });
    await cart.removeListItem(buyer, list.id, got.items[1]!.id);
    expect((await cart.getList(buyer, list.id))!.items).toHaveLength(1);
    await cart.renameList(buyer, list.id, { name: "Villa 12 (final)" });
    await cart.deleteList(other, list.id);
    expect(await db.savedList.count({ where: { id: list.id } })).toBe(1);
    await cart.deleteList(buyer, list.id);
    expect(await db.savedListItem.count({ where: { listId: list.id } })).toBe(0);
  });
});
