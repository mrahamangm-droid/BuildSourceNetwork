import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrl } from "@bmn/config";
import { PrismaClient } from "./generated/client";

export * from "./generated/client";

const globalForPrisma = globalThis as unknown as { __bmnPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = resolveDatabaseUrl(process.env);
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
  });
  return new PrismaClient({ adapter });
}

/** Lazily created singleton so importing this module never needs a database at build time. */
export function getDb(): PrismaClient {
  if (!globalForPrisma.__bmnPrisma) globalForPrisma.__bmnPrisma = createClient();
  return globalForPrisma.__bmnPrisma;
}

export const db = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    return Reflect.get(getDb(), prop);
  },
});
