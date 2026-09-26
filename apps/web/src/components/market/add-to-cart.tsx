"use client";
import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { postJson, type ListRow } from "@/components/cart-api";

/** Quantity + "Add to cart" and a "Save to list" menu for a buyer on a product page. */
export function AddToCart({
  productId,
  minQty,
  unit,
  disabled,
}: {
  productId: string;
  minQty: number;
  unit: string;
  disabled?: boolean;
}) {
  const [qty, setQty] = useState(String(minQty));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [lists, setLists] = useState<ListRow[] | null>(null);
  const [newName, setNewName] = useState("");

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ tone: "success", text: await fn() });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const quantity = Number(qty);
  const loadLists = async () => {
    const res = await fetch(`/api/lists?productId=${encodeURIComponent(productId)}`);
    const data = (await res.json()) as { lists?: ListRow[] };
    setLists(data.lists ?? []);
  };

  return (
    <div className="mt-4 rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="block text-muted">Quantity ({unit})</span>
          <Input
            type="number"
            inputMode="decimal"
            min={minQty}
            step="any"
            className="h-10 w-28"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>
        <Button
          disabled={busy || disabled || !(quantity > 0)}
          onClick={() =>
            run(async () => {
              await postJson("/api/cart", { action: "add", productId, quantity });
              return "Added to your cart.";
            })
          }
        >
          Add to cart
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => (lists ? setLists(null) : run(async () => (await loadLists(), "")))}
        >
          Save to list
        </Button>
        <Link href="/dashboard/cart" className="text-sm text-brand-700 hover:underline">
          View cart
        </Link>
      </div>
      {lists ? (
        <div className="mt-3 border-t border-line pt-3 text-sm">
          {lists.length ? (
            <ul className="mb-2 space-y-1">
              {lists.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <span>{l.name}</span>
                  {l.has ? (
                    <span className="text-xs text-green-700">Saved</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await postJson("/api/lists", {
                            action: "add",
                            listId: l.id,
                            productId,
                            quantity,
                          });
                          setLists(
                            (cur) =>
                              cur?.map((x) => (x.id === l.id ? { ...x, has: true } : x)) ?? cur,
                          );
                          return `Saved to ${l.name}.`;
                        })
                      }
                    >
                      Add
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-muted">You have no lists yet.</p>
          )}
          <div className="flex gap-2">
            <Input
              className="h-9"
              placeholder="New list name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={80}
            />
            <Button
              size="md"
              variant="dark"
              disabled={busy || !newName.trim()}
              onClick={() =>
                run(async () => {
                  await postJson("/api/lists", {
                    action: "create",
                    name: newName,
                    productId,
                    quantity,
                  });
                  setNewName("");
                  await loadLists();
                  return "List created and product saved.";
                })
              }
            >
              Create
            </Button>
          </div>
        </div>
      ) : null}
      {msg ? (
        <div className="mt-3">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      ) : null}
    </div>
  );
}
