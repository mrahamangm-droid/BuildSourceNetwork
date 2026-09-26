import Link from "next/link";
import { Card } from "@/components/ui";
import type { OnboardingStep } from "@/lib/onboarding";

const mark: Record<OnboardingStep["state"], string> = {
  done: "bg-green-600 text-white",
  waiting: "bg-amber-500 text-white",
  todo: "border border-line bg-white text-muted",
};

export function OnboardingChecklist({
  steps,
  done,
  total,
  percent,
}: {
  steps: OnboardingStep[];
  done: number;
  total: number;
  percent: number;
}) {
  const next = steps.find((s) => s.state === "todo");
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Get your business ready for buyers</h2>
        <p className="text-sm text-muted">
          {done} of {total} done
        </p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <div className="h-full bg-brand-600" style={{ width: `${percent}%` }} />
      </div>
      <ol className="mt-3 divide-y divide-line">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-start gap-3 py-3">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${mark[s.state]}`}
              aria-hidden
            >
              {s.state === "done" ? "✓" : s.state === "waiting" ? "…" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${s.state === "done" ? "text-muted" : ""}`}>
                {s.title}
                <span className="sr-only">
                  {s.state === "done" ? " (done)" : s.state === "waiting" ? " (in review)" : ""}
                </span>
              </p>
              <p className="text-sm text-muted">{s.detail}</p>
            </div>
            {s.state === "todo" ? (
              <Link
                href={s.href}
                className={`shrink-0 text-sm font-semibold hover:underline ${
                  s === next ? "text-brand-700" : "text-muted"
                }`}
              >
                {s.cta}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}
