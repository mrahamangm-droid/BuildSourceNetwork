"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DashNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Dashboard"
      className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
    >
      {items.map((i) => {
        const active = i.href === "/dashboard" ? path === "/dashboard" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-surface",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
