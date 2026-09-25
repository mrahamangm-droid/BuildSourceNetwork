import { z } from "zod";
import { db, Prisma } from "@bmn/database";
import { slugify } from "@bmn/config";
import { assertCan, assertOrgType, assertVerified, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { fieldErrorsFrom } from "./accounts";
import { audit } from "./notify";

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

async function assertProductLimit(ctx: Ctx) {
  const sub = await db.subscription.findUnique({
    where: { orgId: ctx.orgId },
    include: { plan: true },
  });
  const limit = sub?.plan.productLimit;
  if (limit == null) return;
  const count = await db.product.count({ where: { orgId: ctx.orgId, isActive: true } });
  if (count >= limit)
    throw new AppError(
      `Your ${sub!.plan.name} plan allows ${limit} active products. Upgrade to add more.`,
      "FORBIDDEN",
    );
}

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
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
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
