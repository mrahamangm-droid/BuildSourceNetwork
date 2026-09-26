/** Shared, framework-free constants. Nothing here touches the database. */

export const ORG_TYPES = ["SUPPLIER", "STORE", "CONTRACTOR", "BUYER"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  SUPPLIER: "Supplier",
  STORE: "Store",
  CONTRACTOR: "Contractor",
  BUYER: "Developer / Buyer",
};

export const ORG_TYPE_DESCRIPTION: Record<OrgType, string> = {
  SUPPLIER: "Manufacturer, distributor or wholesaler selling building materials.",
  STORE: "Building-material shop or trader buying from suppliers and selling on.",
  CONTRACTOR: "Construction company or contractor sourcing materials for projects.",
  BUYER: "Property developer, project buyer or other professional buyer.",
};

export const SUPPLIER_KINDS = ["MANUFACTURER", "DISTRIBUTOR", "WHOLESALER"] as const;
export type SupplierKind = (typeof SUPPLIER_KINDS)[number];
export const SUPPLIER_KIND_LABEL: Record<SupplierKind, string> = {
  MANUFACTURER: "Manufacturer",
  DISTRIBUTOR: "Distributor",
  WHOLESALER: "Wholesaler",
};

/** Organizations of these types can request quotes. */
export const BUYER_TYPES: OrgType[] = ["STORE", "CONTRACTOR", "BUYER"];

export const MEMBER_ROLES = ["OWNER", "ADMIN", "MANAGER", "STAFF"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const PERMISSIONS = [
  "org.manage",
  "team.manage",
  "product.manage",
  "rfq.create",
  "rfq.respond",
  "order.manage",
  "order.view",
  "inventory.manage",
  "customer.manage",
  "project.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  OWNER: [...PERMISSIONS],
  ADMIN: [...PERMISSIONS],
  MANAGER: [
    "product.manage",
    "inventory.manage",
    "customer.manage",
    "project.manage",
    "rfq.create",
    "rfq.respond",
    "order.manage",
    "order.view",
  ],
  STAFF: ["rfq.create", "order.view"],
};

export function roleHas(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const CATEGORIES = [
  "Cement",
  "Steel",
  "Blocks",
  "Tiles",
  "Sand",
  "Gravel",
  "Gypsum",
  "Paint",
  "Waterproofing",
  "Plumbing",
  "Electrical",
  "Sanitaryware",
  "Hardware",
  "Insulation",
  "Doors",
  "Windows",
  "Roofing",
  "Tools",
  "Safety materials",
  "Other construction materials",
] as const;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Units are data, not code: the database stores them (Unit table) and this list only seeds it.
 * `baseCode` + `factor` describe conversion to a base unit of the same dimension (e.g. TON -> KG).
 */
export const UNITS = [
  { code: "PIECE", name: "Piece", dimension: "count", baseCode: "PIECE", factor: 1 },
  { code: "BOX", name: "Box", dimension: "pack", baseCode: "BOX", factor: 1 },
  { code: "BAG", name: "Bag", dimension: "pack", baseCode: "BAG", factor: 1 },
  { code: "KG", name: "Kilogram", dimension: "mass", baseCode: "KG", factor: 1 },
  { code: "TON", name: "Ton", dimension: "mass", baseCode: "KG", factor: 1000 },
  { code: "METER", name: "Meter", dimension: "length", baseCode: "METER", factor: 1 },
  { code: "SQM", name: "Square meter", dimension: "area", baseCode: "SQM", factor: 1 },
  { code: "CBM", name: "Cubic meter", dimension: "volume", baseCode: "CBM", factor: 1 },
  { code: "LITER", name: "Liter", dimension: "liquid", baseCode: "LITER", factor: 1 },
  { code: "ROLL", name: "Roll", dimension: "pack", baseCode: "ROLL", factor: 1 },
  { code: "SET", name: "Set", dimension: "pack", baseCode: "SET", factor: 1 },
  { code: "PALLET", name: "Pallet", dimension: "pack", baseCode: "PALLET", factor: 1 },
  { code: "TRUCK", name: "Truck", dimension: "pack", baseCode: "TRUCK", factor: 1 },
] as const;

export const PLANS = [
  {
    code: "FREE",
    name: "Free",
    priceMonthlyCents: 0,
    productLimit: 10,
    rfqLimit: 5,
    features: ["Business profile", "Up to 10 products", "5 RFQs per month", "Basic dashboard"],
  },
  {
    code: "STARTER",
    name: "Starter",
    priceMonthlyCents: 2900,
    productLimit: 200,
    rfqLimit: 50,
    features: ["1 organization", "Products", "Inventory", "Customers", "Quotes", "Basic reports"],
  },
  {
    code: "BUSINESS",
    name: "Business",
    priceMonthlyCents: 7900,
    productLimit: 2000,
    rfqLimit: 500,
    features: [
      "Multiple users",
      "Advanced inventory",
      "RFQs",
      "Orders",
      "Delivery",
      "Credit",
      "Customer portal",
    ],
  },
  {
    code: "SME",
    name: "SME",
    priceMonthlyCents: 14900,
    productLimit: null,
    rfqLimit: null,
    features: [
      "Multiple branches",
      "Advanced reports",
      "AI features",
      "Advanced permissions",
      "Supplier management",
      "Contractor/project features",
    ],
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    priceMonthlyCents: null,
    productLimit: null,
    rfqLimit: null,
    features: ["Custom pricing", "API access", "Dedicated support"],
  },
] as const;

export const ORDER_STATUSES = [
  "ORDER_CREATED",
  "CONFIRMED",
  "PREPARING",
  "DISPATCHED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  ORDER_CREATED: "Order created",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Allowed forward transitions. Suppliers advance an order; buyers may cancel early or complete. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ORDER_CREATED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const DEMO_LABEL = "Demo data — not a real business";

// ------------------------------------------------------------------ database url

const PG_URL = /^postgres(ql)?:\/\//i;

/**
 * Finds the Postgres connection string. `DATABASE_URL` wins. Otherwise a Vercel storage
 * integration may have added it under a prefix (for example `myproject_DATABASE_URL` or
 * `POSTGRES_URL`); the first plain `postgres://` value among those is used. Prisma Accelerate
 * style `prisma+postgres://` URLs are skipped because the pg driver cannot open them.
 */
export function resolveDatabaseUrl(env: Record<string, string | undefined>): string | undefined {
  const own = env.DATABASE_URL?.trim();
  if (own) return own;
  const suffixes = ["_DATABASE_URL", "POSTGRES_URL", "_POSTGRES_URL"];
  for (const suffix of suffixes) {
    const keys = Object.keys(env)
      .filter((k) => k.endsWith(suffix) && env[k] && PG_URL.test(env[k]!.trim()))
      .sort();
    if (keys.length) return env[keys[0]!]!.trim();
  }
  return undefined;
}
