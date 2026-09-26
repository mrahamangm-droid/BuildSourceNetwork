import { resolveDatabaseUrl } from "@bmn/config";
/**
 * Launch-readiness check for environment variables. Pure: takes an env object and
 * returns findings, never reads process.env itself, so it is unit-testable and can
 * be reused by a CLI or the health route. Values are never returned, only names.
 */
export type Severity = "error" | "warn";
export type EnvFinding = { key: string; severity: Severity; message: string };

type Env = Record<string, string | undefined>;

const has = (env: Env, k: string) => Boolean(env[k] && env[k]!.trim());

export function checkEnv(env: Env): EnvFinding[] {
  const out: EnvFinding[] = [];
  const add = (key: string, severity: Severity, message: string) =>
    out.push({ key, severity, message });
  const prod = env.NODE_ENV === "production";

  if (!resolveDatabaseUrl(env)) add("DATABASE_URL", "error", "Missing: the app cannot start.");
  if (!has(env, "AUTH_SECRET")) add("AUTH_SECRET", "error", "Missing: sessions cannot be signed.");
  else if (env.AUTH_SECRET!.length < 32)
    add("AUTH_SECRET", prod ? "error" : "warn", "Shorter than 32 characters.");

  if (!has(env, "NEXT_PUBLIC_APP_URL"))
    add("NEXT_PUBLIC_APP_URL", "warn", "Missing: emails, sitemap and canonical links need it.");
  else if (prod && !env.NEXT_PUBLIC_APP_URL!.startsWith("https://"))
    add("NEXT_PUBLIC_APP_URL", "error", "Must be https in production.");

  if (!has(env, "CRON_SECRET"))
    add(
      "CRON_SECRET",
      "warn",
      "Missing: the daily expiry cron and the health detail view are locked.",
    );

  if ((env.EMAIL_PROVIDER ?? "console") === "resend") {
    if (!has(env, "RESEND_API_KEY"))
      add("RESEND_API_KEY", "error", "EMAIL_PROVIDER=resend needs it.");
    if (!has(env, "EMAIL_FROM"))
      add("EMAIL_FROM", "error", "EMAIL_PROVIDER=resend needs a verified sender.");
  } else if (prod) {
    add(
      "EMAIL_PROVIDER",
      "warn",
      "Emails are only logged to the console; verification mails will not be delivered.",
    );
  }

  const supa = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !has(env, k));
  if (supa.length === 1) add(supa[0]!, "error", "Set together with the other Supabase variable.");
  if (supa.length === 2 && prod)
    add("SUPABASE_URL", "warn", "Not set: uploads use local disk, which is lost on Vercel.");

  if (has(env, "SUPABASE_URL") && !has(env, "SUPABASE_PRIVATE_BUCKET"))
    add(
      "SUPABASE_PRIVATE_BUCKET",
      "warn",
      'Defaults to "private-files"; make sure that private bucket exists.',
    );

  if (prod && env.SEED_DEMO_PASSWORD)
    add(
      "SEED_DEMO_PASSWORD",
      "warn",
      "Set in production: do not run the demo seed against this database.",
    );

  return out;
}

export const hasErrors = (f: EnvFinding[]) => f.some((x) => x.severity === "error");
