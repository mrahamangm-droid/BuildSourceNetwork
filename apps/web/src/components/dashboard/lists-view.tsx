"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, EmptyState, Input } from "@/components/ui";
import { postJson } from "@/components/cart-api";
import { formatDate, formatMoney } from "@/lib/utils";
import type { CartLine } from "@/server/services/cart";
import { ReorderButton } from "@/components/dashboard/reorder-button";

function useAct() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (fn: () => Promise<void>, refresh = true) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      if (refresh) router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { router, busy, err, act };
}

export function ListsIndex({
  lists,
}: {
  lists: { id: string; name: string; count: number; updatedAt: string }[];
}) {
  const { busy, err, act } = useAct();
  const [name, setName] = useState("");
  return (
    <div className="space-y-4">
      {err ? <Alert tone="error">{err}</Alert> : null}
      <Card className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted">New list</span>
          <Input
            className="h-10 w-64"
            placeholder="e.g. Villa 12 – MEP"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <Button
          disabled={busy || !name.trim()}
          onClick={() =>
            act(async () => {
              await postJson("/api/lists", { action: "create", name });
              setName("");
            })
          }
        >
          Create list
        </Button>
      </Card>
      {lists.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {lists.map((l) => (
            <li key={l.id}>
              <Card className="flex h-full flex-col justify-between gap-3">
                <div>
                  <Link
                    className="font-semibold hover:text-brand-700"
                    href={`/dashboard/lists/${l.id}`}
                  >
                    {l.name}
                  </Link>
                  <p className="text-sm text-muted">
                    {l.count} product{l.count === 1 ? "" : "s"} · updated {formatDate(l.updatedAt)}
                  </p>
                </div>
                {l.count ? (
                  <ReorderButton
                    body={{ action: "add-list", listId: l.id }}
                    label="Add all to cart"
                    variant="outline"
                  />
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No saved lists yet"
          body="Keep the materials you buy again and again in a list, then move it to the cart in one click."
        />
      )}
    </div>
  );
}

export function ListDetail({
  list,
}: {
  list: { id: string; name: string; items: (CartLine & { note: string | null })[] };
}) {
  const { router, busy, err, act } = useAct();
  const [name, setName] = useState(list.name);
  const post = (body: Record<string, unknown>) =>
    act(async () => void (await postJson("/api/lists", { listId: list.id, ...body })));
  return (
    <div className="space-y-4">
      {err ? <Alert tone="error">{err}</Alert> : null}
      <Card className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted">List name</span>
            <Input
              className="h-10 w-64"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button
            variant="outline"
            disabled={busy || !name.trim() || name === list.name}
            onClick={() => post({ action: "rename", name })}
          >
            Rename
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {list.items.length ? (
            <ReorderButton body={{ action: "add-list", listId: list.id }} label="Add all to cart" />
          ) : null}
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Delete “${list.name}”?`))
                act(async () => {
                  await postJson("/api/lists", { action: "delete", listId: list.id });
                  router.push("/dashboard/lists");
                }, false);
            }}
          >
            Delete list
          </Button>
        </div>
      </Card>
      {list.items.length ? (
        <Card>
          <ul className="divide-y divide-line text-sm">
            {list.items.map((i) => (
              <li
                key={i.id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 sm:grid-cols-[1fr_120px_110px_auto]"
              >
                <div className="min-w-0">
                  <Link
                    className="font-medium hover:text-brand-700"
                    href={`/products/${i.productId}`}
                  >
                    {i.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {formatMoney(i.unitPrice.toString(), i.currency)} / {i.unit}
                    {i.issue && i.issue !== `Minimum order is ${i.minOrderQty}`
                      ? ` · ${i.issue}`
                      : ""}
                  </p>
                </div>
                <Input
                  aria-label={`Quantity for ${i.name}`}
                  type="number"
                  step="any"
                  min={i.minOrderQty}
                  defaultValue={i.quantity}
                  className="h-9"
                  disabled={busy}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v > 0 && v !== i.quantity)
                      post({ action: "update-item", itemId: i.id, quantity: v });
                  }}
                />
                <p className="text-right font-medium">
                  {formatMoney(i.lineTotal.toString(), i.currency)}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => post({ action: "remove-item", itemId: i.id })}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState
          title="This list is empty"
          body="Use “Save to list” on any product page to add it here."
        />
      )}
    </div>
  );
}
