# Production deployment checklist

1. Create a Postgres database (Supabase/Neon). Pooled URL → `DATABASE_URL`, direct URL → `DIRECT_URL`.
2. Run `npx prisma migrate deploy` (from `packages/database`) against the production DB. The seed also creates DEMO data; do not run it unchanged in production (load reference data only: categories, units, plans).
3. Create a public Supabase Storage bucket (`public-assets`); set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Set `AUTH_SECRET` (`openssl rand -base64 32`), `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` (verify the sending domain), `CRON_SECRET`.
5. Push the repo to GitHub, import it in Vercel (root directory = repo root; `vercel.json` sets the build). Add the env vars for Production and Preview (use a separate DB for Preview).
6. Add the custom domain (SSL is automatic). Confirm the daily cron (`/api/cron/expire`) appears in Vercel → Cron Jobs.
7. Enable database backups (Supabase PITR / daily) and an error monitor (Sentry or Vercel Observability).
8. Replace the in-memory rate limiter (`apps/web/src/server/rate-limit.ts`) with Upstash/Redis before real traffic.
9. Smoke test: register, verify email, add product, RFQ, quote, accept, order.
