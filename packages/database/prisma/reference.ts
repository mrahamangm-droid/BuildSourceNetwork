/**
 * Reference data every environment needs: categories, units, subscription plans and
 * platform settings. Idempotent (upserts only) and free of demo data, so it is safe to run
 * on every production deploy. Sign-up fails without the FREE plan row.
 */
import { CATEGORIES, PLANS, UNITS, slugify } from "@bmn/config";
import type { PrismaClient } from "../src/generated/client";

export async function seedReference(db: PrismaClient) {
  for (const [i, name] of CATEGORIES.entries()) {
    const slug = slugify(name);
    await db.category.upsert({
      where: { slug },
      update: { name, sortOrder: i },
      create: { slug, name, sortOrder: i },
    });
  }
  for (const u of UNITS) {
    await db.unit.upsert({
      where: { code: u.code },
      update: { name: u.name, dimension: u.dimension, baseCode: u.baseCode, factor: u.factor },
      create: {
        code: u.code,
        name: u.name,
        dimension: u.dimension,
        baseCode: u.baseCode,
        factor: u.factor,
      },
    });
  }
  for (const p of PLANS) {
    const data = {
      name: p.name,
      priceMonthlyCents: p.priceMonthlyCents,
      productLimit: p.productLimit,
      rfqLimit: p.rfqLimit,
      features: [...p.features],
    };
    await db.subscriptionPlan.upsert({
      where: { code: p.code },
      update: data,
      create: { code: p.code, ...data },
    });
  }
  for (const [key, value] of Object.entries({
    platformFeeBps: "100",
    rfqExpiryDays: "7",
    defaultCurrency: "AED",
  })) {
    await db.platformSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}
