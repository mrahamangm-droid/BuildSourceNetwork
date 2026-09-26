import { z } from "zod";
import { db, Prisma } from "@bmn/database";
import { slugify } from "@bmn/config";
import { assertCan, assertOrgType, assertVerified, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { fieldErrorsFrom } from "./accounts";
import { audit } from "./notify";
import { assertWithinLimit } from "./plans";
import { rankMatches, tokenize, type MatchCandidate } from "@/lib/match";
import { rankAlternatives, type AltCandidate } from "@/lib/alternatives";

const money = z.coerce.number().positive("Must be greater than 0").max(1e9);
const optMoney = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().positive().max(1e9).optional(),
);

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name").max(160),
  sku: z.string().trim().max(60).optional().default(""),
  categoryId: z.string().min(1, "Choose a category"),
  brandName: z.string().trim().max(80).optional().default(""),
  unitCode: z.string().min(1, "Choose a unit"),
  description: z.string().trim().max(4000).optional().default(""),
  packageSize: z.string().trim().max(80).optional().default(""),
  minOrderQty: z.coerce.number().positive("Must be greater than 0").max(1e9).default(1),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "ON_REQUEST"]).default("IN_STOCK"),
  price: money,
  wholesalePrice: optMoney,
  contractorPrice: optMoney,
  vatRatePercent: z.coerce.number().min(0).max(100).default(5),
  city: z.string().trim().max(80).optional().default(""),
  deliveryAvailable: z.coerce.boolean().default(true),
  isActive: z.coerce.boolean().default(true),
  /** "Key: value" per line */
  specifications: z.string().max(3000).optional().default(""),
  imageUrl: z.string().trim().max(500).optional().default(""),
});
export type ProductInput = z.infer<typeof productSchema>;

function parseSpecs(text: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return Object.keys(out).length ? out : undefined;
}

async function uniqueProductSlug(orgId: string, name: string, excludeId?: string) {
  const root = slugify(name) || "product";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const hit = await db.product.findFirst({
      where: { orgId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!hit) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

const assertProductLimit = (ctx: Ctx) => assertWithinLimit(ctx.orgId, "product");

async function resolveRefs(d: ProductInput) {
  const [cat, unit] = await Promise.all([
    db.category.findUnique({ where: { id: d.categoryId }, select: { id: true } }),
    db.unit.findUnique({ where: { code: d.unitCode }, select: { code: true } }),
  ]);
  if (!cat)
    throw new AppError("Unknown category", "VALIDATION", { categoryId: "Choose a valid category" });
  if (!unit) throw new AppError("Unknown unit", "VALIDATION", { unitCode: "Choose a valid unit" });
  const brand = d.brandName
    ? await db.brand.upsert({
        where: { slug: slugify(d.brandName) },
        update: {},
        create: { slug: slugify(d.brandName), name: d.brandName },
      })
    : null;
  return { brandId: brand?.id ?? null };
}

const SELLER_TYPES = ["SUPPLIER", "STORE"] as const;

export async function createProduct(ctx: Ctx, raw: unknown) {
  assertCan(ctx, "product.manage");
  assertOrgType(ctx, ...SELLER_TYPES);
  assertVerified(ctx);
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "Please fix the highlighted fields.",
      "VALIDATION",
      fieldErrorsFrom(parsed.error),
    );
  const d = parsed.data;
  await assertProductLimit(ctx);
  const { brandId } = await resolveRefs(d);
  if (d.sku) {
    const dup = await db.product.findFirst({
      where: { orgId: ctx.orgId, sku: d.sku },
      select: { id: true },
    });
    if (dup)
      throw new AppError("SKU already used", "CONFLICT", {
        sku: "You already have a product with this SKU",
      });
  }
  const org = await db.organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
    select: { city: true },
  });
  const product = await db.product.create({
    data: {
      orgId: ctx.orgId,
      categoryId: d.categoryId,
      brandId,
      unitCode: d.unitCode,
      sku: d.sku || null,
      name: d.name,
      slug: await uniqueProductSlug(ctx.orgId, d.name),
      description: d.description || null,
      specifications: parseSpecs(d.specifications),
      packageSize: d.packageSize || null,
      minOrderQty: d.minOrderQty,
      stockStatus: d.stockStatus,
      price: d.price,
      wholesalePrice: d.wholesalePrice,
      contractorPrice: d.contractorPrice,
      vatRatePercent: d.vatRatePercent,
      city: d.city || org.city,
      deliveryAvailable: d.deliveryAvailable,
      isActive: d.isActive,
      prices: { create: { price: d.price, tier: "RETAIL", changedBy: ctx.userId } },
      ...(d.imageUrl ? { images: { create: { url: d.imageUrl, alt: d.name } } } : {}),
    },
  });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "product.created",
    entity: "Product",
    entityId: product.id,
  });
  return product;
}

export async function updateProduct(ctx: Ctx, id: string, raw: unknown) {
  assertCan(ctx, "product.manage");
  const existing = await db.product.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!existing) throw new AppError("Product not found", "NOT_FOUND");
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "Please fix the highlighted fields.",
      "VALIDATION",
      fieldErrorsFrom(parsed.error),
    );
  const d = parsed.data;
  const { brandId } = await resolveRefs(d);
  if (d.sku && d.sku !== existing.sku) {
    const dup = await db.product.findFirst({
      where: { orgId: ctx.orgId, sku: d.sku, id: { not: id } },
      select: { id: true },
    });
    if (dup)
      throw new AppError("SKU already used", "CONFLICT", {
        sku: "You already have a product with this SKU",
      });
  }
  if (d.isActive && !existing.isActive) await assertProductLimit(ctx);
  const priceChanged = Number(existing.price) !== d.price;
  const product = await db.product.update({
    where: { id },
    data: {
      categoryId: d.categoryId,
      brandId,
      unitCode: d.unitCode,
      sku: d.sku || null,
      name: d.name,
      slug:
        d.name !== existing.name ? await uniqueProductSlug(ctx.orgId, d.name, id) : existing.slug,
      description: d.description || null,
      specifications: parseSpecs(d.specifications) ?? Prisma.JsonNull,
      packageSize: d.packageSize || null,
      minOrderQty: d.minOrderQty,
      stockStatus: d.stockStatus,
      price: d.price,
      wholesalePrice: d.wholesalePrice ?? null,
      contractorPrice: d.contractorPrice ?? null,
      vatRatePercent: d.vatRatePercent,
      city: d.city || existing.city,
      deliveryAvailable: d.deliveryAvailable,
      isActive: d.isActive,
      ...(priceChanged
        ? { prices: { create: { price: d.price, tier: "RETAIL", changedBy: ctx.userId } } }
        : {}),
    },
  });
  if (d.imageUrl) {
    await db.productImage.deleteMany({ where: { productId: id } });
    await db.productImage.create({ data: { productId: id, url: d.imageUrl, alt: d.name } });
  }
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "product.updated",
    entity: "Product",
    entityId: id,
  });
  return product;
}

export async function archiveProduct(ctx: Ctx, id: string) {
  assertCan(ctx, "product.manage");
  const res = await db.product.updateMany({
    where: { id, orgId: ctx.orgId },
    data: { isActive: false },
  });
  if (res.count === 0) throw new AppError("Product not found", "NOT_FOUND");
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "product.archived",
    entity: "Product",
    entityId: id,
  });
}

export async function listOwnProducts(ctx: Ctx, page = 1, pageSize = 20) {
  const where = { orgId: ctx.orgId };
  const [total, items] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: { category: true, unit: true, brand: true },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, items, page, pageSize };
}

export async function getOwnProduct(ctx: Ctx, id: string) {
  return db.product.findFirst({
    where: { id, orgId: ctx.orgId },
    include: { brand: true, images: true },
  });
}

export type SearchFilters = {
  q?: string;
  category?: string;
  brand?: string;
  supplier?: string;
  city?: string;
  verifiedOnly?: boolean;
  inStockOnly?: boolean;
  deliveryOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  maxMoq?: number;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest";
  page?: number;
  pageSize?: number;
};

/** Public marketplace query. Only active products of active organizations are ever returned. */
export async function searchProducts(f: SearchFilters) {
  const pageSize = Math.min(f.pageSize ?? 12, 48);
  const page = Math.max(1, f.page ?? 1);
  const and: Prisma.ProductWhereInput[] = [];
  if (f.q) {
    const terms = f.q.split(/\s+/).filter(Boolean).slice(0, 6);
    for (const t of terms) {
      and.push({
        OR: [
          { name: { contains: t, mode: "insensitive" } },
          { sku: { contains: t, mode: "insensitive" } },
          { description: { contains: t, mode: "insensitive" } },
          { brand: { name: { contains: t, mode: "insensitive" } } },
          { category: { name: { contains: t, mode: "insensitive" } } },
          { org: { name: { contains: t, mode: "insensitive" } } },
        ],
      });
    }
  }
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    org: {
      isActive: true,
      ...(f.verifiedOnly ? { verificationStatus: "VERIFIED" } : {}),
      ...(f.supplier ? { slug: f.supplier } : {}),
    },
    ...(f.category ? { category: { slug: f.category } } : {}),
    ...(f.brand ? { brand: { slug: f.brand } } : {}),
    ...(f.city
      ? {
          OR: [
            { city: { equals: f.city, mode: "insensitive" } },
            { org: { deliveryAreas: { has: f.city } } },
          ],
        }
      : {}),
    ...(f.inStockOnly ? { stockStatus: { in: ["IN_STOCK", "LOW_STOCK"] } } : {}),
    ...(f.deliveryOnly ? { deliveryAvailable: true } : {}),
    ...(f.minPrice != null || f.maxPrice != null
      ? {
          price: {
            ...(f.minPrice != null ? { gte: f.minPrice } : {}),
            ...(f.maxPrice != null ? { lte: f.maxPrice } : {}),
          },
        }
      : {}),
    ...(f.maxMoq != null ? { minOrderQty: { lte: f.maxMoq } } : {}),
    ...(and.length ? { AND: and } : {}),
  };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    f.sort === "price_asc"
      ? [{ price: "asc" }]
      : f.sort === "price_desc"
        ? [{ price: "desc" }]
        : f.sort === "newest"
          ? [{ createdAt: "desc" }]
          : [{ org: { verificationStatus: "asc" } }, { name: "asc" }];
  const [total, items] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        price: true,
        currency: true,
        minOrderQty: true,
        stockStatus: true,
        city: true,
        deliveryAvailable: true,
        packageSize: true,
        isDemo: true,
        unit: { select: { code: true, name: true } },
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true, slug: true } },
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            verificationStatus: true,
            city: true,
            isDemo: true,
          },
        },
        images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      },
    }),
  ]);
  return { total, items, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getPublicProduct(id: string) {
  return db.product.findFirst({
    where: { id, isActive: true, org: { isActive: true } },
    include: {
      unit: true,
      category: true,
      brand: true,
      images: { orderBy: { sortOrder: "asc" } },
      priceBreaks: { orderBy: { minQty: "asc" } },
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          supplierKind: true,
          city: true,
          verificationStatus: true,
          isDemo: true,
          deliveryAreas: true,
        },
      },
    },
  });
}

export async function categoriesWithCounts() {
  const cats = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { products: { where: { isActive: true, org: { isActive: true } } } } },
    },
  });
  return cats;
}

// ───────────────────────── smart matching and alternatives ─────────────────────────

const num = (d: { toString(): string } | null | undefined) =>
  d == null ? 0 : Number(d.toString());

/**
 * Smart Material Matching: finds active products for a free-text need and ranks them (see
 * lib/match). Only public, active listings of active organizations are ever considered.
 */
export async function matchProducts(input: {
  q: string;
  city?: string;
  qty?: number;
  limit?: number;
}) {
  const tokens = tokenize(input.q);
  if (!tokens.length) return [];
  const rows = await db.product.findMany({
    where: {
      isActive: true,
      org: { isActive: true },
      OR: tokens.flatMap((t) => [
        { name: { contains: t, mode: "insensitive" as const } },
        { sku: { contains: t, mode: "insensitive" as const } },
        { description: { contains: t, mode: "insensitive" as const } },
        { brand: { name: { contains: t, mode: "insensitive" as const } } },
        { category: { name: { contains: t, mode: "insensitive" as const } } },
      ]),
    },
    take: 300,
    select: {
      id: true,
      name: true,
      sku: true,
      description: true,
      price: true,
      currency: true,
      minOrderQty: true,
      stockStatus: true,
      city: true,
      deliveryAvailable: true,
      unit: { select: { name: true } },
      brand: { select: { name: true } },
      category: { select: { name: true } },
      images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          supplierKind: true,
          city: true,
          verificationStatus: true,
          deliveryAreas: true,
          isDemo: true,
        },
      },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const cands: MatchCandidate[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    description: r.description,
    brandName: r.brand?.name ?? null,
    categoryName: r.category.name,
    price: num(r.price),
    minOrderQty: num(r.minOrderQty),
    stockStatus: r.stockStatus,
    city: r.city,
    deliveryAvailable: r.deliveryAvailable,
    orgId: r.org.id,
    orgName: r.org.name,
    orgCity: r.org.city,
    orgVerified: r.org.verificationStatus === "VERIFIED",
    deliveryAreas: r.org.deliveryAreas,
  }));
  return rankMatches(
    cands,
    { q: input.q, city: input.city, qty: input.qty },
    input.limit ?? 10,
  ).map((m) => ({ ...m, product: byId.get(m.item.id)! }));
}

/** Smart Alternatives for a product page: same category and unit, ranked by closeness. */
export async function alternativesFor(productId: string, limit = 4) {
  const base = await db.product.findFirst({
    where: { id: productId, isActive: true, org: { isActive: true } },
    select: {
      id: true,
      orgId: true,
      brandId: true,
      categoryId: true,
      unitCode: true,
      price: true,
      city: true,
      specifications: true,
    },
  });
  if (!base) return [];
  const rows = await db.product.findMany({
    where: {
      id: { not: base.id },
      isActive: true,
      categoryId: base.categoryId,
      unitCode: base.unitCode,
      stockStatus: { not: "OUT_OF_STOCK" },
      org: { isActive: true },
    },
    take: 80,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      orgId: true,
      brandId: true,
      name: true,
      price: true,
      currency: true,
      city: true,
      stockStatus: true,
      deliveryAvailable: true,
      specifications: true,
      unit: { select: { name: true } },
      images: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      org: {
        select: {
          name: true,
          slug: true,
          type: true,
          city: true,
          verificationStatus: true,
          deliveryAreas: true,
          isDemo: true,
        },
      },
    },
  });
  const specs = (v: unknown): Record<string, string> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, String(x)]),
        )
      : {};
  const byId = new Map(rows.map((r) => [r.id, r]));
  const cands: (AltCandidate & { id: string })[] = rows.map((r) => ({
    id: r.id,
    orgId: r.orgId,
    brandId: r.brandId,
    price: num(r.price),
    city: r.city,
    specifications: specs(r.specifications),
    name: r.name,
    stockStatus: r.stockStatus,
    deliveryAvailable: r.deliveryAvailable,
    orgVerified: r.org.verificationStatus === "VERIFIED",
    orgCity: r.org.city,
    deliveryAreas: r.org.deliveryAreas,
  }));
  return rankAlternatives(
    {
      id: base.id,
      orgId: base.orgId,
      brandId: base.brandId,
      price: num(base.price),
      city: base.city,
      specifications: specs(base.specifications),
    },
    cands,
    { limit },
  ).map((a) => ({ ...a, product: byId.get(a.item.id)! }));
}
