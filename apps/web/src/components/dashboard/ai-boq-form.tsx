"use client";
import { useActionState, useState } from "react";
import { Card, Field, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import {
  addAiBoqLinesAction,
  suggestAiBoqAction,
  type ActionState,
  type AiBoqState,
} from "@/server/actions";

type Line = NonNullable<AiBoqState["lines"]>[number];

function Review({ projectId, lines }: { projectId: string; lines: Line[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addAiBoqLinesAction, {});
  const [picked, setPicked] = useState<boolean[]>(() => lines.map(() => true));
  const chosen = lines.filter((_, i) => picked[i]);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="lines" value={JSON.stringify(chosen)} />
      <p className="text-sm font-medium">Review the draft ({chosen.length} selected)</p>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2" />
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
      <SubmitButton>Add {chosen.length} selected lines</SubmitButton>
    </form>
  );
}

export function AiBoqForm({
  projectId,
  configured,
  remaining,
  cap,
  planName,
}: {
  projectId: string;
  configured: boolean;
  remaining: number;
  cap: number;
  planName: string;
}) {
  const [state, action] = useActionState<AiBoqState, FormData>(suggestAiBoqAction, {});
  return (
    <Card>
      <h3 className="font-semibold">Draft a bill with AI</h3>
      <p className="mt-1 text-sm text-muted">
        Describe the project (type, area, floors, structure, finishes). The AI proposes material
        lines that you review before anything is saved. Quantities are estimates, not a drawing
        take-off: check every line before you buy. Lines are added without rates.
      </p>
      {!configured ? (
        <p className="mt-3 text-sm text-muted">AI drafting is not enabled on this platform yet.</p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted">
            {remaining} of {cap} AI drafts left in the last 30 days on the {planName} plan.
          </p>
          <form action={action} className="mt-3 space-y-3">
            <input type="hidden" name="projectId" value={projectId} />
            <Field label="Project description" error={fe(state, "description")}>
              <Textarea
                name="description"
                rows={5}
                minLength={20}
                maxLength={2000}
                required
                placeholder="G+1 villa, 420 m2 gross area, RC frame with 200mm block walls, tiled floors, painted internally, external plaster and paint."
              />
            </Field>
            <FormMessage state={state} />
            <SubmitButton>Draft lines</SubmitButton>
          </form>
          {state.ok && state.lines ? (
            <Review key={JSON.stringify(state.lines)} projectId={projectId} lines={state.lines} />
          ) : null}
        </>
      )}
    </Card>
  );
}
