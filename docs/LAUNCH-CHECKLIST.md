# Launch checklist

Work through this top to bottom. Each item is something only you can do or confirm.

## 1. Code on main

All feature pull requests are merged and CI is green on `main`. If you change anything later, keep `npm run format:check`, `npm run typecheck`, `npm test` and `npm run build` passing; CI runs all four.

## 2. Repository hygiene

- Add `.uploads` and `.uploads-private` to `.gitignore` (local-disk upload folders).
- Add `SUPABASE_PRIVATE_BUCKET="private-files"` to `.env.example`.

## 3. Database

Use a dedicated, empty Postgres database for this app. A shared or pre-existing database that already has tables (for example a `User` table from another project) makes the first migration fail with `relation "User" already exists`.

Production builds on Vercel run, in order, `prisma migrate deploy` and then `npm run db:seed:reference` (see `vercel.json`; previews skip both, and a failed step fails the build so a bad schema never goes live). The reference seed is idempotent and creates only categories, units, subscription plans and platform settings. It is required: sign-up creates a Free subscription and fails with a foreign-key error (`Subscription_planCode_fkey`) if the plan rows are missing. To run the steps by hand, use `npx prisma migrate deploy` (applies everything up to `20261006000000_blog`) and `npm run db:seed:reference`.

Never run the full demo seed (`npm run db:seed`) in production: it adds demo companies and users.

Create the first platform admin by registering normally, then run in the database console: `UPDATE "User" SET "isPlatformAdmin" = true WHERE email = '<your email>';`

## 4. Storage

Create two Supabase buckets: a public one for product and logo images (`SUPABASE_STORAGE_BUCKET`) and a private one, `private-files` (`SUPABASE_PRIVATE_BUCKET`), for RFQ attachments. The private bucket must not be public; downloads are served through an authorised route.

## 5. Environment and health

Set the variables from `.env.example` in Vercel. If a Vercel storage integration added the database under a prefixed name such as `myproject_DATABASE_URL`, the app finds it automatically; a plain `DATABASE_URL` is not required. After deploy, call `GET /api/health` with `Authorization: Bearer <CRON_SECRET>`; it lists any missing or weak variables (names only). Without the header it returns just `{"ok":true|false}`, suitable for an uptime monitor.

## 5a. Email (required before real users)

With `EMAIL_PROVIDER` unset, mail is only written to the server log (`[mail:dev]` lines), so nobody receives verification or password-reset emails, and an account that is not email-verified cannot create products or send RFQs and quotes. For production set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `EMAIL_FROM` (a sender on a domain verified with Resend). Until then, a one-time verification link can be copied from the log by the site owner; links expire, so request a fresh one from the dashboard banner first.

## 5b. Optional: AI BOQ drafting

Set `ANTHROPIC_API_KEY` in Vercel to enable "Draft a bill with AI" on project pages (leave it unset and the card says the feature is not enabled). `ANTHROPIC_MODEL` overrides the default model id. Drafts are capped per 30 days by plan (Free 3, Starter 30, SME 150; see `lib/ai-boq.ts`) and cost real API usage, so set a spend limit in the Anthropic console. Nothing the model returns is saved until the user reviews and confirms it.

## 6. Smoke test on staging

Register a buyer and a supplier; verify email; post an RFQ with an attachment; quote; accept; receive stock; reserve it on the order; transfer between two warehouses; request a plan and approve it as admin; publish a blog post; check `/sitemap.xml`, `/manufacturers`, `/blog`; with the AI key set, draft a bill from a project description and add two lines.

## 7. Known limitations

- Rate limiting is in memory, per server instance. Replace with Upstash or Redis before real traffic.
- Plan activation is manual (admin approves a request); there is no online payment.
- No WhatsApp notifications. AI features are limited to the optional BOQ drafting above.
- Database-backed tests and the browser flow were not run in the build environment; CI is the first place they run.
