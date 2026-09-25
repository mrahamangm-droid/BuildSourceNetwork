import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { CATEGORIES, PLANS, UNITS, slugify } from "@bmn/config";

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://bmn:bmn_local_dev@localhost:5432/bmn_test";
process.env.DATABASE_URL = TEST_DB_URL;

const migrationsDir = path.resolve(__dirname, "../../../packages/database/prisma/migrations");

/** Rebuilds the test schema straight from the migration SQL files (no Prisma CLI needed). */
export async function resetDb() {
  const client = new pg.Client({ connectionString: TEST_DB_URL });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const dirs = fs
    .readdirSync(migrationsDir)
    .filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory())
    .sort();
  for (const d of dirs)
    await client.query(fs.readFileSync(path.join(migrationsDir, d, "migration.sql"), "utf8"));
  await client.end();

  const { db } = await import("@bmn/database");
  for (const [i, name] of CATEGORIES.entries())
    await db.category.create({ data: { slug: slugify(name), name, sortOrder: i } });
  for (const u of UNITS)
    await db.unit.create({
      data: {
        code: u.code,
        name: u.name,
        dimension: u.dimension,
        baseCode: u.baseCode,
        factor: u.factor,
      },
    });
  for (const p of PLANS)
    await db.subscriptionPlan.create({
      data: {
        code: p.code,
        name: p.name,
        priceMonthlyCents: p.priceMonthlyCents,
        productLimit: p.productLimit,
        rfqLimit: p.rfqLimit,
        features: [...p.features],
      },
    });
  await db.platformSetting.create({ data: { key: "platformFeeBps", value: "100" } });
}

let n = 0;
export async function makeAccount(
  orgType: "SUPPLIER" | "STORE" | "CONTRACTOR" | "BUYER",
  opts: { verify?: boolean; city?: string; name?: string } = {},
) {
  const { registerAccount, verifyEmail } = await import("@/server/services/accounts");
  const { buildCtx } = await import("@/server/ctx");
  const { resetRateLimits } = await import("@/server/rate-limit");
  resetRateLimits();
  n += 1;
  const res = await registerAccount({
    name: `Test User ${n}`,
    email: `user${n}@test.example`,
    password: "Sup3rSecret!pw",
    orgType,
    orgName: opts.name ?? `Test ${orgType} ${n}`,
    city: opts.city ?? "Sharjah",
  });
  if (opts.verify !== false) await verifyEmail(res.verifyToken!);
  const ctx = (await buildCtx(res.userId))!;
  return { ctx, userId: res.userId, verifyToken: res.verifyToken! };
}
