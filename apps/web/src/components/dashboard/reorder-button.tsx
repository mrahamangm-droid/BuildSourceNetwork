"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { postJson } from "@/components/cart-api";

type Result = { added: number; skipped: { name: string; reason: string }[] };

/** Puts a past order's products (or a saved list) into the cart in one click. */
export function ReorderButton({
  body,
  label,
  variant = "primary",
}: {
  body: Record<string, unknown>;
  label: string;
  variant?: "primary" | "outline";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Result["skipped"]>([]);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const r = await postJson<Result>("/api/cart", body);
      if (r.skipped.length) {
        setSkipped(r.skipped);
        if (r.added) router.refresh();
      } else router.push("/dashboard/cart");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button size="sm" variant={variant} disabled={busy} onClick={go}>
        {busy ? "Adding…" : label}
      </Button>
      {err ? <p className="mt-2 text-sm text-red-700">{err}</p> : null}
      {skipped.length ? (
        <div className="mt-2 max-w-md">
          <Alert tone="info">
            Added to your cart, except: {skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}.{" "}
            <Link className="font-medium underline" href="/dashboard/cart">
              Open cart
            </Link>
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
