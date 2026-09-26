"use client";

import * as React from "react";
import Link from "next/link";
import { Card, Field, Input, Select, LinkButton } from "@/components/ui";
import { defaultValues, formatResult, getCalculator, type Values } from "@/lib/calculators";

export function CalculatorForm({ slug }: { slug: string }) {
  const calc = getCalculator(slug)!;
  const [values, setValues] = React.useState<Values>(() => defaultValues(calc));
  const out = React.useMemo(() => calc.compute(values), [calc, values]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="font-semibold">Your measurements</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {calc.inputs.map((i) => (
            <Field key={i.key} label={i.type === "number" && i.unit ? `${i.label} (${i.unit})` : i.label}>
              {i.type === "select" ? (
                <Select
                  value={String(values[i.key])}
                  onChange={(e) => setValues((v) => ({ ...v, [i.key]: e.target.value }))}
                >
                  {i.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type="number"
                  inputMode="decimal"
                  min={i.min}
                  step={i.step}
                  value={values[i.key] as number}
                  onChange={(e) => setValues((v) => ({ ...v, [i.key]: e.target.value }))}
                />
              )}
            </Field>
          ))}
        </div>
      </Card>
      <Card aria-live="polite">
        <h2 className="font-semibold">Estimate</h2>
        <dl className="mt-4 divide-y divide-line">
          {out.rows.map((r) => (
            <div key={r.label + r.unit} className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-sm text-muted">{r.label}</dt>
              <dd className={r.primary ? "text-2xl font-bold text-brand-700" : "font-semibold"}>
                {formatResult(r)} <span className="text-sm font-normal text-muted">{r.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
        {out.notes?.map((n) => (
          <p key={n} className="mt-3 text-xs text-muted">
            {n}
          </p>
        ))}
        <div className="mt-5 flex flex-wrap gap-2">
          <LinkButton
            href={calc.categoryHint ? `/dashboard/rfqs/new?category=${calc.categoryHint}` : "/dashboard/rfqs/new"}
          >
            Get quotes for these materials
          </LinkButton>
          <Link
            href={calc.categoryHint ? `/building-materials/${calc.categoryHint}` : "/marketplace"}
            className="inline-flex h-10 items-center text-sm font-semibold text-brand-700 hover:underline"
          >
            Browse suppliers
          </Link>
        </div>
      </Card>
    </div>
  );
}
