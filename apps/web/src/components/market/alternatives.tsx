import Link from "next/link";
import { Card } from "@/components/ui";
import { StockBadge } from "@/components/market/parts";
import { formatMoney } from "@/lib/utils";

export type AlternativeCard = {
  reasons: string[];
  product: {
    id: string;
    name: string;
    price: { toString(): string };
    currency: string;
    stockStatus: string;
    city: string | null;
    unit: { name: string };
    images: { url: string; alt: string | null }[];
    org: { name: string; slug: string; type: string };
  };
};

/** Comparable products from other suppliers, each with the reasons it was suggested. */
export function Alternatives({
  items,
  title = "Smart alternatives",
  note,
}: {
  items: AlternativeCard[];
  title?: string;
  note?: string;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-10" aria-labelledby="alt-h">
      <h2 id="alt-h" className="text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">
        {note ?? "Same category and unit, ranked by stock, price, brand and delivery area."}
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ product: p, reasons }) => (
          <Card key={p.id} className="flex flex-col gap-2 p-4">
            <StockBadge status={p.stockStatus} />
            <Link
              href={`/products/${p.id}`}
              className="font-semibold leading-snug hover:text-brand-700"
            >
              {p.name}
            </Link>
            <p className="text-xs text-muted">
              <Link
                href={`/${p.org.type === "STORE" ? "stores" : "suppliers"}/${p.org.slug}`}
                className="hover:underline"
              >
                {p.org.name}
              </Link>
              {p.city ? ` · ${p.city}` : ""}
            </p>
            <p className="font-bold">
              {formatMoney(p.price.toString(), p.currency)}{" "}
              <span className="text-xs font-normal text-muted">/ {p.unit.name.toLowerCase()}</span>
            </p>
            {reasons.length ? (
              <ul className="mt-auto space-y-0.5 text-xs text-slate-600">
                {reasons.slice(0, 3).map((r) => (
                  <li key={r}>✓ {r}</li>
                ))}
              </ul>
            ) : null}
          </Card>
        ))}
      </div>
    </section>
  );
}
