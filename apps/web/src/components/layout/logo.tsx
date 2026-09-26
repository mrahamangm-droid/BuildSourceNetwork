import Link from "next/link";
import { BRAND } from "@/lib/company";
import { cn } from "@/lib/utils";

/** The brand mark: a cube (material) whose edges are a network graph. Inline so it never blocks rendering. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-8 w-8 shrink-0", className)} aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#ea580c" />
      <g fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 11 51 22v20L32 53 13 42V22Z" />
        <path d="M13 22 32 33 51 22M32 33v20" />
      </g>
      <g fill="#fff">
        <circle cx="32" cy="33" r="5.2" />
        <circle cx="32" cy="11" r="3.6" />
        <circle cx="51" cy="22" r="3.6" />
        <circle cx="51" cy="42" r="3.6" />
        <circle cx="32" cy="53" r="3.6" />
        <circle cx="13" cy="42" r="3.6" />
        <circle cx="13" cy="22" r="3.6" />
      </g>
    </svg>
  );
}

/** Mark + wordmark. Text inherits colour, so it works on light and dark backgrounds. */
export function Logo({
  className,
  href = "/",
  hideWordmarkOnMobile = false,
}: {
  className?: string;
  href?: string | null;
  /** header use: keep the bar uncluttered on phones */
  hideWordmarkOnMobile?: boolean;
}) {
  const body = (
    <>
      <LogoMark />
      <span
        className={cn("flex-col leading-none", hideWordmarkOnMobile ? "hidden sm:flex" : "flex")}
      >
        <span className="text-[17px] font-extrabold tracking-tight">BuildSource</span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.32em] opacity-60">
          Network
        </span>
      </span>
    </>
  );
  const cls = cn("inline-flex items-center gap-2.5", className);
  return href ? (
    <Link href={href} className={cls} aria-label={`${BRAND.name} home`}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}
