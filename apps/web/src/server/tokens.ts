import { createHash, randomBytes } from "node:crypto";
import { db } from "@bmn/database";
import type { TokenType } from "@bmn/database";

const TTL_MS: Record<TokenType, number> = {
  EMAIL_VERIFY: 48 * 3600_000,
  PASSWORD_RESET: 60 * 60_000,
};

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Returns the raw token (only ever sent by email); only its hash is stored. */
export async function issueToken(userId: string, type: TokenType): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await db.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });
  await db.authToken.create({
    data: { userId, type, tokenHash: sha(raw), expiresAt: new Date(Date.now() + TTL_MS[type]) },
  });
  return raw;
}

/** Atomically consumes a token; returns the userId or null if invalid/expired/used. */
export async function consumeToken(raw: string, type: TokenType): Promise<string | null> {
  const row = await db.authToken.findUnique({ where: { tokenHash: sha(raw) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  const res = await db.authToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return res.count === 1 ? row.userId : null;
}
