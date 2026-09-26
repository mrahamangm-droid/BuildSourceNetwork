import "dotenv/config";
import { defineConfig } from "prisma/config";

// Same lookup as resolveDatabaseUrl in @bmn/config (kept inline so the Prisma CLI needs no workspace import).
const pg = (v?: string) => (v && /^postgres(ql)?:\/\//i.test(v.trim()) ? v.trim() : undefined);
const prefixed = (suffix: string) =>
  Object.keys(process.env)
    .filter((k) => k.endsWith(suffix) && pg(process.env[k]))
    .sort()
    .map((k) => pg(process.env[k]))[0];
const url =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  prefixed("_DATABASE_URL") ||
  prefixed("POSTGRES_URL") ||
  "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url },
});
