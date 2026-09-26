"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Textarea } from "@/components/ui";
import { postJson } from "@/components/cart-api";
import { formatMoney } from "@/lib/utils";
import type { CartGroup } from "@/server/services/cart";

type Cart = { groups: CartGroup[]; lineCount: number; subtotal: number; vat: number };

export function CartView({ cart, defaultCity }: { cart: Cart; defaultCity: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(
    new Set(cart.groups.filter((g) => g.orderable).map((g) => `${g.supplierOrgId}|${g.currency}`)),
  );
  const [form, setForm] = useState({
    deliveryCity: defaultCity,
    deliveryAddress: "",
    requiredDate: "",
    notes: "",
  });
  const [listName, setListName] = useState("");

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const call = (body: Record<string, unknown>, url = "/api/cart") =>
    act(async () => {
      await postJson(url, body);
      router.refresh();
    });

  if (!cart.lineCount)
    return (
      <EmptyState
        title="Your cart is empty"
        body="Add products from the marketplace, or move a saved list into the cart."
        action={
          <div className="flex justify-center gap-2">
            <Link
              className="text-sm font-medium text-brand-700 hover:underline"
              href="/marketplace"
            >
              Browse the marketplace
            </Link>
            <Link
              className="text-sm font-medium text-brand-700 hover:underline"
              href="/dashboard/lists"
            >
              Saved lists
            </Link>
          </div>
        }
      />
    );

  const picked = cart.groups.filter(
    (g) => chosen.has(`${g.supplierOrgId}|${g.currency}`) && g.orderable,
  );
  const supplierIds = [...new Set(picked.map((g) => g.supplierOrgId))];

  function checkout() {
    return act(async () => {
      const r = await postJson<{
        orders: { id: string }[];
        skipped: { name: string; reason: string }[];
      }>("/api/cart", {
        action: "checkout",
        ...form,
        requiredDate: form.requiredDate || undefined,
        supplierOrgIds: supplierIds,
      });
      if (r.orders.length === 1) router.push(`/dashboard/orders/${r.orders[0]!.id}?placed=1`);
      else router.push("/dashboard/orders?placed=" + r.orders.length);
    });
  }

  return (
    <div className="space-y-4">
      {err ? <Alert tone="error">{err}</Alert> : null}
      {note ? <Alert tone="success">{note}</Alert> : null}
      {cart.groups.map((g) => {
        const key = `${g.supplierOrgId}|${g.currency}`;
        return (
          <Card key={key}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={chosen.has(key) && g.orderable}
                  disabled={!g.orderable}
                  onChange={(e) =>
                    setChosen((cur) => {
                      const n = new Set(cur);
                      if (e.target.checked) n.add(key);
                      else n.delete(key);
                      return n;
                    })
                  }
                />
                {g.supplierName}
              </label>
              {g.orderable ? null : <Badge tone="amber">Fix the highlighted items to order</Badge>}
            </div>
            <ul className="divide-y divide-line text-sm">
              {g.lines.map((l) => (
                <li
                  key={l.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 sm:grid-cols-[1fr_120px_110px_auto]"
                >
                  <div className="min-w-0">
                    <Link
                      className="font-medium hover:text-brand-700"
                      href={`/products/${l.productId}`}
                    >
                      {l.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {formatMoney(l.unitPrice.toString(), g.currency)} / {l.unit}
                      {l.unitPrice < l.basePrice ? " · volume price applied" : ""}
                    </p>
                    {l.issue ? <p className="text-xs font-medium text-red-700">{l.issue}</p> : null}
                  </div>
                  <Input
                    aria-label={`Quantity for ${l.name}`}
                    type="number"
                    min={l.minOrderQty}
                    step="any"
                    defaultValue={l.quantity}
                    className="h-9"
                    disabled={busy}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v > 0 && v !== l.quantity)
                        call({ action: "quantity", itemId: l.id, quantity: v });
                    }}
                  />
                  <p className="text-right font-medium">
                    {formatMoney(l.lineTotal.toString(), g.currency)}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => call({ action: "remove", itemId: l.id })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right text-sm">
              Subtotal{" "}
              <span className="font-semibold">
                {formatMoney(g.subtotal.toString(), g.currency)}
              </span>
              <span className="text-muted"> + VAT {formatMoney(g.vat.toString(), g.currency)}</span>
            </p>
          </Card>
        );
      })}

      <Card>
        <h2 className="font-semibold">Delivery details</h2>
        <p className="mb-3 text-sm text-muted">
          One order is created for each supplier you check out. Delivery charges, if any, are agreed
          with the supplier when they confirm.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted">City</span>
            <Input
              value={form.deliveryCity}
              onChange={(e) => setForm({ ...form, deliveryCity: e.target.value })}
              className="h-10"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Required by (optional)</span>
            <Input
              type="date"
              value={form.requiredDate}
              onChange={(e) => setForm({ ...form, requiredDate: e.target.value })}
              className="h-10"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Site address (optional)</span>
            <Input
              value={form.deliveryAddress}
              onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
              className="h-10"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Notes for the supplier (optional)</span>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {picked.length ? (
              <>
                {picked.length} supplier{picked.length === 1 ? "" : "s"} selected ·{" "}
                <span className="font-semibold">
                  {picked.map((g) => formatMoney(g.subtotal.toString(), g.currency)).join(" + ")}
                </span>{" "}
                <span className="text-muted">before VAT</span>
              </>
            ) : (
              <span className="text-muted">Select at least one supplier to check out.</span>
            )}
          </p>
          <Button
            disabled={busy || !picked.length || form.deliveryCity.trim().length < 2}
            onClick={checkout}
          >
            {busy ? "Placing…" : `Place ${picked.length > 1 ? picked.length + " orders" : "order"}`}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Save this cart as a list</span>
            <Input
              className="h-9 w-56"
              placeholder="List name"
              maxLength={80}
              value={listName}
              onChange={(e) => setListName(e.target.value)}
            />
          </label>
          <Button
            variant="outline"
            disabled={busy || !listName.trim()}
            onClick={() =>
              act(async () => {
                await postJson("/api/lists", { action: "from-cart", name: listName });
                setListName("");
                setNote("Saved. Find it under Saved lists.");
              })
            }
          >
            Save list
          </Button>
        </div>
        <Button variant="ghost" disabled={busy} onClick={() => call({ action: "clear" })}>
          Empty cart
        </Button>
      </Card>
    </div>
  );
}
