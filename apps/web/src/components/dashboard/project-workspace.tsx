import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@bmn/config";
import type { getProcurement } from "@/server/services/projects";
import { cn } from "@/lib/utils";

type Data = Awaited<ReturnType<typeof getProcurement>>;

const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** BOQ -> RFQ -> Quotes -> Orders -> Delivery in one place, including the split across suppliers. */
export function ProjectWorkspace({ data }: { data: Data }) {
  const { stages, split, rfqs, orders } = data;
  const currency = orders[0]?.currency;
  return (
    <section aria-labelledby="ws-h" className="space-y-4">
      <div>
        <h2 id="ws-h" className="text-lg font-semibold">
          Procurement workspace
        </h2>
        <p className="text-sm text-muted">
          Tick BOQ lines below and request quotes: the request, its quotes, the order and delivery
          all stay linked to this project.
        </p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-5">
        {stages.map((s, i) => (
          <li
            key={s.key}
            aria-current={s.state === "active" ? "step" : undefined}
            className={cn(
              "rounded-xl border p-3",
              s.state === "done" && "border-emerald-200 bg-emerald-50/60",
              s.state === "active" && "border-brand-600 bg-brand-50",
              s.state === "todo" && "border-line bg-white",
            )}
          >
            <p className="text-xs uppercase text-muted">
              {i + 1}. {s.label}
            </p>
            <p className="mt-1 text-xl font-bold">{s.count}</p>
            <p className="text-xs text-muted">{s.detail}</p>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="text-sm">
          <h3 className="font-semibold">Requests for this project</h3>
          {rfqs.length ? (
            <ul className="mt-2 divide-y divide-line">
              {rfqs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <Link
                    className="font-medium text-brand-700 hover:underline"
                    href={`/dashboard/rfqs/${r.id}`}
                  >
                    {r.number}
                    {r.title ? (
                      <span className="font-normal text-slate-600"> · {r.title}</span>
                    ) : null}
                  </Link>
                  <span className="flex items-center gap-2 whitespace-nowrap text-xs text-muted">
                    {r.quoteCount} quote{r.quoteCount === 1 ? "" : "s"}
                    <Badge
                      tone={
                        r.status === "ACCEPTED" ? "green" : r.status === "OPEN" ? "blue" : "neutral"
                      }
                    >
                      {label(r.status)}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted">
              None yet. Tick lines in the bill below and choose “Request quotes for ticked lines”.
            </p>
          )}
        </Card>
        <Card className="text-sm">
          <h3 className="font-semibold">Orders and suppliers</h3>
          {orders.length ? (
            <>
              <ul className="mt-2 divide-y divide-line">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                    <Link
                      className="font-medium text-brand-700 hover:underline"
                      href={`/dashboard/orders/${o.id}`}
                    >
                      {o.number}
                      <span className="font-normal text-slate-600"> · {o.supplierName}</span>
                    </Link>
                    <span className="flex items-center gap-2 whitespace-nowrap text-xs">
                      {formatMoney(o.total.toString(), o.currency)}
                      <Badge
                        tone={o.delivered ? "green" : o.status === "CANCELLED" ? "red" : "blue"}
                      >
                        {ORDER_STATUS_LABEL[o.status as OrderStatus] ?? label(o.status)}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
              {split.length > 1 && currency ? (
                <div className="mt-3 rounded-lg bg-surface p-3">
                  <p className="text-xs font-semibold uppercase text-muted">
                    Spend across {split.length} suppliers
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {split.map((x) => (
                      <li key={x.supplierOrgId} className="flex justify-between">
                        <span>{x.supplierName}</span>
                        <span className="font-medium">
                          {formatMoney(x.total.toString(), currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-muted">
              Orders appear here when you accept a quote. Each line of a project can go to a
              different supplier by sending separate requests.
            </p>
          )}
        </Card>
      </div>
    </section>
  );
}
