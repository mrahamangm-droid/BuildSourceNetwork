import { CHAIN, chainRoleLabel, chainStepFor } from "@/lib/supply-chain";
import { cn } from "@/lib/utils";

/**
 * Manufacturer -> Supplier -> Store -> Contractor/Developer, with this organization highlighted.
 * Position comes from the account type and supplier kind; the tick only shows for admin-verified businesses.
 */
export function SupplyChain({
  org,
}: {
  org: { type: string; supplierKind?: string | null; verificationStatus: string };
}) {
  const here = chainStepFor(org);
  const verified = org.verificationStatus === "VERIFIED";
  return (
    <div>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs" aria-label="Supply chain">
        {CHAIN.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1">
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 font-medium",
                s.key === here
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-line text-muted",
              )}
              aria-current={s.key === here ? "step" : undefined}
            >
              {s.key === here ? chainRoleLabel(org) : s.label}
              {s.key === here && verified ? " ✓" : ""}
            </span>
            {i < CHAIN.length - 1 ? (
              <span aria-hidden="true" className="text-muted">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted">
        {verified
          ? "Verified business: its documents were reviewed and approved."
          : "Not verified yet: ask for documents before large orders."}
      </p>
    </div>
  );
}
