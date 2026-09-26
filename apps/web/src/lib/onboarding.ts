/**
 * Supplier / store onboarding checklist. Pure: takes a snapshot of the organization's state and
 * returns the ordered steps with their status, so it can be unit-tested without a database.
 */
export type OnboardingInput = {
  emailVerified: boolean;
  description: string | null;
  phone: string | null;
  logoUrl: string | null;
  deliveryAreas: number;
  leadTimeDays: number | null;
  minOrderNote: string | null;
  activeProducts: number;
  productsWithPhoto: number;
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
};

export type OnboardingStep = {
  key: "email" | "profile" | "terms" | "products" | "photos" | "verification";
  title: string;
  detail: string;
  href: string;
  cta: string;
  state: "done" | "todo" | "waiting";
};

const filled = (s: string | null) => !!s && s.trim().length > 0;

export function buildOnboardingSteps(i: OnboardingInput): OnboardingStep[] {
  const profileMissing = [
    !filled(i.description) && "description",
    !filled(i.phone) && "phone",
    !filled(i.logoUrl) && "logo",
  ].filter(Boolean) as string[];
  const termsDone = i.deliveryAreas > 0 || i.leadTimeDays !== null || filled(i.minOrderNote);

  const v = i.verificationStatus;
  const verification: OnboardingStep = {
    key: "verification",
    title: "Get verified",
    href: "/dashboard/verification",
    cta: v === "REJECTED" ? "Resubmit documents" : "Submit documents",
    detail:
      v === "VERIFIED"
        ? "Your business is verified and shows the verified badge."
        : v === "PENDING"
          ? "Your documents are under review. We will notify you when there is a decision."
          : v === "REJECTED"
            ? "Your last submission was not approved. Check the reviewer note and submit again."
            : "Upload your trade licence and tax number. Verified businesses are ranked higher and can publish products and send quotes.",
    state: v === "VERIFIED" ? "done" : v === "PENDING" ? "waiting" : "todo",
  };

  return [
    {
      key: "email",
      title: "Confirm your email",
      detail: i.emailVerified
        ? "Email confirmed."
        : "Open the link we sent to your inbox (the banner at the top can resend it). You cannot publish products or send quotes until this is done.",
      href: "/dashboard/settings",
      cta: "Account settings",
      state: i.emailVerified ? "done" : "todo",
    },
    {
      key: "profile",
      title: "Complete your company profile",
      detail: profileMissing.length
        ? `Still missing: ${profileMissing.join(", ")}. Buyers check this before they request a quote.`
        : "Description, phone and logo are set.",
      href: "/dashboard/profile",
      cta: "Edit profile",
      state: profileMissing.length ? "todo" : "done",
    },
    {
      key: "terms",
      title: "Set delivery areas and terms",
      detail: termsDone
        ? "Delivery and ordering terms are set."
        : "Add the areas you deliver to, your usual lead time or a minimum order note, so buyers know what to expect.",
      href: "/dashboard/profile",
      cta: "Add terms",
      state: termsDone ? "done" : "todo",
    },
    {
      key: "products",
      title: "Add your products",
      detail:
        i.activeProducts > 0
          ? `${i.activeProducts} active product${i.activeProducts === 1 ? "" : "s"} listed.`
          : "List at least one product. Have many? Import them from a spreadsheet in one go.",
      href: i.activeProducts > 0 ? "/dashboard/products" : "/dashboard/products/import",
      cta: i.activeProducts > 0 ? "View products" : "Import or add products",
      state: i.activeProducts > 0 ? "done" : "todo",
    },
    {
      key: "photos",
      title: "Add product photos",
      detail:
        i.activeProducts === 0
          ? "Add products first, then give them photos."
          : i.productsWithPhoto > 0
            ? `${i.productsWithPhoto} of ${i.activeProducts} products have a photo.`
            : "Listings with photos get noticed more. Add a photo to your best sellers.",
      href: "/dashboard/products",
      cta: "Open products",
      state: i.productsWithPhoto > 0 ? "done" : "todo",
    },
    verification,
  ];
}

export function onboardingProgress(steps: OnboardingStep[]) {
  const done = steps.filter((s) => s.state === "done").length;
  return { done, total: steps.length, percent: Math.round((done / steps.length) * 100) };
}
