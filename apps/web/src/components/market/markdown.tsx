import Link from "next/link";
import { parseMarkdown, type Inline } from "@/lib/markdown";

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case "b":
            return <strong key={i}>{n.v}</strong>;
          case "i":
            return <em key={i}>{n.v}</em>;
          case "code":
            return (
              <code key={i} className="rounded bg-surface px-1 py-0.5 text-[0.9em]">
                {n.v}
              </code>
            );
          case "a":
            return n.external ? (
              <a
                key={i}
                href={n.href}
                rel="noopener noreferrer"
                target="_blank"
                className="text-brand-700 underline"
              >
                {n.v}
              </a>
            ) : (
              <Link key={i} href={n.href} className="text-brand-700 underline">
                {n.v}
              </Link>
            );
          default:
            return <span key={i}>{n.v}</span>;
        }
      })}
    </>
  );
}

/** Renders the safe Markdown subset as React elements: author-typed HTML is never interpreted. */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-4 text-[1.02rem] leading-7 text-slate-800">
      {parseMarkdown(source).map((b, i) => {
        switch (b.t) {
          case "h2":
            return (
              <h2 key={i} className="pt-4 text-2xl font-bold tracking-tight text-slate-900">
                <Inlines nodes={b.inline} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="pt-2 text-xl font-semibold text-slate-900">
                <Inlines nodes={b.inline} />
              </h3>
            );
          case "quote":
            return (
              <blockquote key={i} className="border-l-4 border-line pl-4 text-slate-600">
                <Inlines nodes={b.inline} />
              </blockquote>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-1 pl-6">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines nodes={it} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-1 pl-6">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines nodes={it} />
                  </li>
                ))}
              </ol>
            );
          case "hr":
            return <hr key={i} className="border-line" />;
          default:
            return (
              <p key={i}>
                <Inlines nodes={b.inline} />
              </p>
            );
        }
      })}
    </div>
  );
}
