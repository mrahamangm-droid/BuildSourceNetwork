"use client";
import { useActionState, useState } from "react";
import { Card, Field, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import {
  addImportedBoqLinesAction,
  previewBoqImportAction,
  type ActionState,
  type BoqImportState,
} from "@/server/actions";

type Line = NonNullable<BoqImportState["lines"]>[number];

function Review({ projectId, lines }: { projectId: string; lines: Line[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addImportedBoqLinesAction, {});
  const [picked, setPicked] = useState<boolean[]>(() => lines.map(() => true));
  const chosen = lines.filter((_, i) => picked[i]);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="lines" value={JSON.stringify(chosen)} />
      <p className="text-sm font-medium">Review the import ({chosen.length} selected)</p>
      <div className="max-h-96 overflow-auto rounded-lg border border-line">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">
                <span className="sr-only">Include</span>
              </th>
              <th className="px-3 py-2">Section</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Waste %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l, i) => (
              <tr key={i} className={picked[i] ? "" : "opacity-50"}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Include ${l.description}`}
                    checked={picked[i]}
                    onChange={() => setPicked((p) => p.map((v, j) => (j === i ? !v : v)))}
                  />
                </td>
                <td className="px-3 py-2">{l.section}</td>
                <td className="px-3 py-2">{l.description}</td>
                <td className="px-3 py-2">{l.quantity}</td>
                <td className="px-3 py-2">{l.unit}</td>
                <td className="px-3 py-2">{l.wastePercent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormMessage state={state} />
      <SubmitButton disabled={!chosen.length}>Add {chosen.length} selected lines</SubmitButton>
    </form>
  );
}

export function BoqImportForm({ projectId }: { projectId: string }) {
  const [state, action] = useActionState<BoqImportState, FormData>(previewBoqImportAction, {});
  return (
    <Card>
      <h3 className="font-semibold">Import a BOQ or material list</h3>
      <p className="mt-1 text-sm text-muted">
        Upload a .csv, .tsv or .txt file, or paste rows from Excel. Columns like Item, Qty and Unit
        (optionally Section and Waste %) are detected automatically, and plain lines such as “Cement
        42.5N - 200 bags” work too. Nothing is saved until you review the lines below.
      </p>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="projectId" value={projectId} />
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
            rows={5}
            maxLength={200000}
            placeholder={
              "Item,Qty,Unit,Section\nCement 42.5N,200,bag,Structure\nRebar 12mm,3.5,ton,Structure"
            }
          />
        </Field>
        <FormMessage state={state} />
        <SubmitButton pending="Reading…">Read list</SubmitButton>
      </form>
      {state.ok && state.lines ? (
        <>
          {state.truncated ? (
            <p className="mt-3 text-sm text-amber-700">
              Only the first 200 lines are shown. Import the rest in a second file.
            </p>
          ) : null}
          {state.skipped?.length ? (
            <p className="mt-3 text-sm text-muted">
              Skipped {state.skipped.length} row{state.skipped.length === 1 ? "" : "s"} we could not
              read: {state.skipped.slice(0, 3).join(" · ")}
              {state.skipped.length > 3 ? " …" : ""}
            </p>
          ) : null}
          <Review key={JSON.stringify(state.lines)} projectId={projectId} lines={state.lines} />
        </>
      ) : null}
    </Card>
  );
}
