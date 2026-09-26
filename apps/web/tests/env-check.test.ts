import { describe, expect, it } from "vitest";
import { checkEnv, hasErrors } from "../src/lib/env-check";

const base = {
  DATABASE_URL: "postgres://x",
  AUTH_SECRET: "a".repeat(40),
  NEXT_PUBLIC_APP_URL: "https://example.com",
  CRON_SECRET: "c",
};
const keys = (env: Record<string, string>) => checkEnv(env).map((f) => `${f.severity}:${f.key}`);

describe("checkEnv", () => {
  it("passes a complete development config", () => {
    expect(checkEnv({ ...base, NODE_ENV: "development" })).toEqual([]);
  });
  it("flags missing required variables as errors", () => {
    const f = checkEnv({});
    expect(hasErrors(f)).toBe(true);
    expect(f.map((x) => x.key)).toEqual(expect.arrayContaining(["DATABASE_URL", "AUTH_SECRET"]));
  });
  it("requires https and a long secret in production", () => {
    const k = keys({
      ...base,
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "http://x.com",
      AUTH_SECRET: "short",
    });
    expect(k).toEqual(expect.arrayContaining(["error:NEXT_PUBLIC_APP_URL", "error:AUTH_SECRET"]));
  });
  it("resend needs key and sender", () => {
    expect(keys({ ...base, EMAIL_PROVIDER: "resend" })).toEqual(
      expect.arrayContaining(["error:RESEND_API_KEY", "error:EMAIL_FROM"]),
    );
  });
  it("supabase variables must come as a pair", () => {
    expect(keys({ ...base, SUPABASE_URL: "https://s.supabase.co" })).toContain(
      "error:SUPABASE_SERVICE_ROLE_KEY",
    );
  });
  it("warns about local disk storage in production", () => {
    expect(keys({ ...base, NODE_ENV: "production" })).toContain("warn:SUPABASE_URL");
  });
  it("never leaks values", () => {
    expect(JSON.stringify(checkEnv({ ...base, AUTH_SECRET: "topsecret" }))).not.toContain(
      "topsecret",
    );
  });
});
