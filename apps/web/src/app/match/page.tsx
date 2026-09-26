import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Button, Card, Input, LinkButton } from "@/components/ui";
import { StockBadge, VerifiedBadge } from "@/components/market/parts";
import { matchProducts } from "@/server/services/products";
import { chainRoleLabel } from "@/lib/supply-chain";
import { formatMoney, formatQty } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Smart material matching",
  description:
    "Describe the material you need and get ranked products and suppliers, with the reasons shown: stock, delivery area, verification, price and minimum order.",
  alternates: { canonical: "/match" },
};

type SP = { q?: string; city?: string; qty?: string };

export default async function MatchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 200);
  const city = (sp.city ?? "").trim().slice(0, 80);
  const qtyNum = Number(sp.qty);
  const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : undefined;
  const results = q ? await matchProducts({ q, city: city || undefined, qty, limit: 10 }) : [];
  const rfqQs = new URLSearchParams({ material: q, ...(city ? { city } : {}) }).toString();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Smart material matching</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Tell us what you need. We rank matching products, one per supplier, and show exactly why
        each one made the list.
      </p>
      <form
        method="get"
        className="mt-6 grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_180px_120px_auto]"
      >
        <label className="block text-sm font-medium">
          Material
          <Input
            name="q"
            defaultValue={q}
            required
            maxLength={200}
            placeholder="e.g. cement 42.5N, 12mm rebar, 60x60 floor tiles"
            className="mt-1"
          />
        </label>
        <label className="block text-sm font-medium">
          Delivery city
          <Input
            name="city"
            defaultValue={city}
            maxLength={80}
            placeholder="Dubai"
            className="mt-1"
          />
        </label>
        <label className="block text-sm font-medium">
          Quantity
          <Input
            name="qty"
            type="number"
            min="0"
            step="any"
            defaultValue={qty ?? ""}
            className="mt-1"
          />
        </label>
        <Button type="submit" className="self-end">
          Find matches
        </Button>
      </form>

      {q && !results.length ? (
        <div className="mt-6">
          <Alert>
            No listed product matches “{q}” yet. Send a request instead and suppliers will quote for
            it.
          </Alert>
          <LinkButton href={`/request-quotes?${rfqQs}`} className="mt-3">
            Request quotes for “{q}”
          </LinkButton>
        </div>
      ) : null}

      {results.length ? (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              {results.length} supplier{results.length === 1 ? "" : "s"} matched, best first.
            </p>
            <LinkButton href={`/request-quotes?${rfqQs}`} variant="dark" size="sm">
              Get 3 Quotes for this material
            </LinkButton>
          </div>
          <ol className="mt-3 space-y-3">
            {results.map(({ item, product: p, score, reasons }, i) => (
              <li key={item.id}>
                <Card className="flex flex-wrap items-start gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <StockBadge status={p.stockStatus} />
                      <VerifiedBadge status={p.org.verificationStatus} />
                    </div>
                    <Link
                      href={`/products/${p.id}`}
                      className="mt-1 block font-semibold hover:text-brand-700"
                    >
                      {p.name}
                    </Link>
                    <p className="text-sm text-muted">
                      <Link
                        href={`/${p.org.type === "STORE" ? "stores" : "suppliers"}/${p.org.slug}`}
                        className="hover:underline"
                      >
                        {p.org.name}
                      </Link>{" "}
                      · {chainRoleLabel(p.org)}
                      {p.org.city ? ` · ${p.org.city}` : ""}
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      {reasons.map((r) => (
                        <li key={r}>✓ {r}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      {formatMoney(p.price.toString(), p.currency)}
                    </p>
                    <p className="text-xs text-muted">
                      / {p.unit.name.toLowerCase()} · MOQ {formatQty(p.minOrderQty)}
                    </p>
                    <p className="mt-1 text-xs text-muted">Match score {Math.round(score)}</p>
                    <LinkButton
                      href={`/request-quotes?productId=${p.id}&supplier=${p.org.id}&mode=custom`}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      Ask this supplier
                    </LinkButton>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {!q ? (
        <Card className="mt-6 text-sm text-muted">
          Try “cement 42.5N”, “rebar 12mm” or “60x60 tiles”. Add your delivery city to prefer
          suppliers that serve it, and a quantity to flag minimum-order mismatches.
        </Card>
      ) : null}
    </div>
  );
}
