"use client";
import { useActionState, useState } from "react";
import { Card, Field, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import {
  importProductsAction,
  previewProductImportAction,
  type ActionState,
  type ProductImportState,
} from "@/server/actions";
import { formatMoney } from "@/lib/utils";

type Row = NonNullable<ProductImportState["rows"]>[number];

function Review({ rows }: { rows: Row[] }) {
  const [state, action] = useActionState<ActionState, FormData>(importProductsAction, {});
  const [picked, setPicked] = useState<boolean[]>(() => rows.map(() => true));
  const chosen = rows.filter((_, i) => picked[i]);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="rows" value={JSON.stringify(chosen)} />
      <p className="text-sm font-medium">
        Ready to add ({chosen.length} of {rows.length} selected)
      </p>
      <div className="max-h-96 overflow-auto rounded-lg border border-line">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">
                <span className="sr-only">Include</span>
              </th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i} className={picked[i] ? "" : "opacity-50"}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Include ${r.name}`}
                    checked={picked[i]}
                    onChange={() => setPicked((p) => p.map((v, j) => (j === i ? !v : v)))}
                  />
                </td>
                <td className="px-3 py-2">
                  {r.name}
                  {r.brandName || r.sku ? (
                    <span className="block text-xs text-muted">
                      {[r.brandName, r.sku && `SKU ${r.sku}`].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">{r.categoryName}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatMoney(String(r.price), "AED")} / {r.unitCode.toLowerCase()}
                </td>
                <td className="px-3 py-2">{r.stockStatus.replace(/_/g, " ").toLowerCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormMessage state={state} />
      <SubmitButton disabled={!chosen.length} pending="Adding…">
        Add {chosen.length} product{chosen.length === 1 ? "" : "s"}
      </SubmitButton>
    </form>
  );
}

export function ProductImportForm() {
  const [state, action] = useActionState<ProductImportState, FormData>(
    previewProductImportAction,
    {},
  );
  return (
    <Card>
      <h3 className="font-semibold">Import products from a spreadsheet</h3>
      <p className="mt-1 text-sm text-muted">
        Upload a .csv, .tsv or .txt file, or paste rows straight from Excel. The first row must be a
        header with at least <strong>Name</strong> and <strong>Price</strong>; Unit and Category are
        needed for each product (we can guess the category from the name for common materials).
        Optional columns: Brand, SKU, Wholesale price, Contractor price, Min qty, Stock, Package,
        City, Description, VAT %. Nothing is saved until you review the list.
      </p>
      <p className="mt-2 text-sm">
        <a
          className="font-medium text-brand-700 hover:underline"
          href="/templates/bsn-products-template.csv"
          download
        >
          Download the template
        </a>
      </p>
      <form action={action} className="mt-3 space-y-3">
        <Field label="Upload file (max 200 KB)">
          <input
            type="file"
            name="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold"
          />
        </Field>
        <Field label="…or paste your list" error={fe(state, "text")}>
          <Textarea
            name="text"
            rows={6}
            maxLength={200000}
            placeholder={
              "Name,Category,Unit,Price,Brand,SKU\nOPC Cement 50kg,Cement,bag,18.50,Acme,OPC-50\nRebar 12mm,Steel,ton,2450,,"
            }
          />
        </Field>
        <FormMessage state={state} />
        <SubmitButton pending="Reading…">Read list</SubmitButton>
      </form>
      {state.ok ? (
        <>
          {state.truncated ? (
            <p className="mt-3 text-sm text-amber-700">
              Only the first 100 products are shown. Import the rest in a second file.
            </p>
          ) : null}
          {state.issues?.length ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-900">
                {state.issues.length} row{state.issues.length === 1 ? "" : "s"} skipped
              </p>
              <ul className="mt-1 space-y-0.5 text-amber-900">
                {state.issues.slice(0, 8).map((i, k) => (
                  <li key={k}>
                    {i.row ? `Row ${i.row}` : "Row"}
                    {i.name ? ` (${i.name})` : ""}: {i.message}
                  </li>
                ))}
                {state.issues.length > 8 ? <li>…and {state.issues.length - 8} more</li> : null}
              </ul>
            </div>
          ) : null}
          {state.rows?.length ? (
            <Review key={JSON.stringify(state.rows)} rows={state.rows} />
          ) : (
            <p className="mt-3 text-sm text-muted">
              No valid products were found. Fix the rows above and read the list again.
            </p>
          )}
        </>
      ) : null}
    </Card>
  );
}
