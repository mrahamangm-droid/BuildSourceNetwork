/**
 * Seeds reference data only (no demo rows). Run automatically after migrations on
 * production builds; safe to re-run.
 */
import { resolveDatabaseUrl } from "@bmn/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/client";
import { seedReference } from "./reference";

const connectionString = resolveDatabaseUrl(process.env);
if (!connectionString) {
  console.error("No database URL found (DATABASE_URL or a prefixed *_DATABASE_URL).");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

seedReference(db)
  .then(() => console.log("Reference data is up to date."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
