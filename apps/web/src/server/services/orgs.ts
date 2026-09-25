import { z } from "zod";
import { db } from "@bmn/database";
import type { Ctx } from "../ctx";
import { assertCan } from "../ctx";
import { AppError } from "../errors";
import { fieldErrorsFrom } from "./accounts";
import { audit } from "./notify";

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Must start with http:// or https://");

export const orgProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().email().or(z.literal("")).optional().default(""),
  website: optionalUrl.optional().default(""),
  addressLine: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(2, "Enter a city").max(80),
  businessHours: z.string().trim().max(200).optional().default(""),
  deliveryAreas: z.string().trim().max(500).optional().default(""),
  categoryIds: z.array(z.string()).optional().default([]),
  logoUrl: optionalUrl.optional(),
  coverUrl: optionalUrl.optional(),
});

export async function updateOrgProfile(ctx: Ctx, raw: unknown) {
  assertCan(ctx, "org.manage");
  const parsed = orgProfileSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "Please fix the highlighted fields.",
      "VALIDATION",
      fieldErrorsFrom(parsed.error),
    );
  const d = parsed.data;
  const cats = d.categoryIds.length
    ? await db.category.findMany({ where: { id: { in: d.categoryIds } }, select: { id: true } })
    : [];
  const org = await db.organization.update({
    where: { id: ctx.orgId },
    data: {
      name: d.name,
      description: d.description || null,
      phone: d.phone || null,
      email: d.email || null,
      website: d.website || null,
      addressLine: d.addressLine || null,
      city: d.city,
      region: d.city,
      businessHours: d.businessHours || null,
      deliveryAreas: d.deliveryAreas
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      categories: { set: cats.map((c) => ({ id: c.id })) },
      ...(d.logoUrl !== undefined ? { logoUrl: d.logoUrl || null } : {}),
      ...(d.coverUrl !== undefined ? { coverUrl: d.coverUrl || null } : {}),
    },
  });
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "org.updated",
    entity: "Organization",
    entityId: org.id,
  });
  return org;
}

export async function getOwnOrg(ctx: Ctx) {
  return db.organization.findUniqueOrThrow({
    where: { id: ctx.orgId },
    include: { categories: true, subscription: { include: { plan: true } } },
  });
}

/** Aggregate trust metrics computed from real transactions — reviews cannot be typed in freely. */
export async function trustMetrics(orgId: string) {
  const [rating, completed, recipients, responded] = await Promise.all([
    db.review.aggregate({ where: { subjectOrgId: orgId }, _avg: { rating: true }, _count: true }),
    db.order.count({ where: { supplierOrgId: orgId, status: "COMPLETED" } }),
    db.rfqRecipient.count({ where: { supplierOrgId: orgId } }),
    db.rfqRecipient.count({ where: { supplierOrgId: orgId, status: "RESPONDED" } }),
  ]);
  return {
    rating: rating._avg.rating,
    reviewCount: rating._count,
    completedOrders: completed,
    responseRate: recipients ? Math.round((responded / recipients) * 100) : null,
  };
}

const PUBLIC_ORG_SELECT = {
  id: true,
  type: true,
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  coverUrl: true,
  phone: true,
  email: true,
  website: true,
  addressLine: true,
  city: true,
  businessHours: true,
  deliveryAreas: true,
  verificationStatus: true,
  isDemo: true,
  createdAt: true,
  categories: { select: { id: true, name: true, slug: true } },
} as const;

export async function listPublicOrgs(opts: {
  type: "SUPPLIER" | "STORE";
  city?: string;
  categorySlug?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = opts.pageSize ?? 12;
  const page = Math.max(1, opts.page ?? 1);
  const where = {
    type: opts.type,
    isActive: true,
    ...(opts.city ? { city: { equals: opts.city, mode: "insensitive" as const } } : {}),
    ...(opts.categorySlug ? { categories: { some: { slug: opts.categorySlug } } } : {}),
    ...(opts.q ? { name: { contains: opts.q, mode: "insensitive" as const } } : {}),
  };
  const [total, items] = await Promise.all([
    db.organization.count({ where }),
    db.organization.findMany({
      where,
      select: {
        ...PUBLIC_ORG_SELECT,
        _count: { select: { products: { where: { isActive: true } } } },
      },
      orderBy: [{ verificationStatus: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, items, page, pageSize };
}

export async function getPublicOrg(slug: string, type: "SUPPLIER" | "STORE") {
  const org = await db.organization.findFirst({
    where: { slug, type, isActive: true },
    select: PUBLIC_ORG_SELECT,
  });
  if (!org) return null;
  return { org, metrics: await trustMetrics(org.id) };
}
