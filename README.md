# Building Materials Network

B2B marketplace and SaaS for the building-materials industry: **Search → Find suppliers → Get 3 quotes → Compare → Order → Review.**
Stack: Next.js 16 (App Router), TypeScript, Tailwind 4, PostgreSQL, Prisma 7, Auth.js v5, Vercel.

## Built so far (Phase 1 core loop)

Authentication (sign up, login, logout, email verification, forgot/reset password), roles and organization-scoped access, supplier/store/contractor/buyer onboarding, company profile with logo and cover upload, product catalogue (units, MOQ, wholesale/contractor price, VAT, price history), public marketplace with search and filters, supplier/store public profiles with trust metrics, **RFQ + Get 3 Quotes** with supplier matching, supplier quote response, **side-by-side comparison**, accept → order, order status flow, reviews after completed orders, in-app and email notifications, role dashboards, SEO (metadata, JSON-LD, sitemap, robots, category/city pages), PWA manifest.

Phase 2 (in progress): **admin panel** (`/admin`: overview, verification queue, companies with suspend/revoke, platform settings) and **company verification** (`/dashboard/verification` → admin approve/reject → Verified badge, audit-logged, notifies the company). Admin accounts need no organization; set `isPlatformAdmin` on a user.

Not built yet (spec phases 2–4): inventory, customers/credit, delivery records and driver view, pricing engine beyond price tiers, projects/BOQ/AI, calculators, blog, subscription billing, multi-branch, RFQ file attachments.

## Layout

```
apps/web            Next.js app (src/server = services, actions, auth; tests/, e2e/)
packages/database   Prisma schema, migrations, seed, client
packages/config     Shared constants (roles, units, plans, categories)
docs/               TESTING.md, DEPLOYMENT.md
```

## Local setup

```
cp .env.example .env            # also copy to apps/web/.env.local; set DATABASE_URL and AUTH_SECRET
npm install
npm run db:generate
npm run db:deploy               # applies migrations
npm run db:seed                 # reference data + clearly-marked DEMO data
npm run dev
```

Demo logins (password `Demo@12345`): `supplier1@` … `supplier6@`, `store1@`, `contractor1@`, `buyer1@`, `admin@`, all at `demo.bmn.example`. Demo companies are labelled **Demo** and never marked verified.
Verification and reset emails are printed to the server console unless `EMAIL_PROVIDER=resend`.

## Scripts

`npm run dev | build | start | lint | typecheck | test | format` and `npm run db:migrate | db:deploy | db:seed | db:reset`

## Architecture notes

- **Tenancy:** every private row carries an org id; services take a `Ctx` (user, org, role) and always filter by it (`apps/web/src/server/ctx.ts`). Orders are visible only to the buying and supplying orgs; RFQs only to the buyer and its recipients.
- **Totals** are computed server-side; quote acceptance is transactional and race-safe.
- **Pluggable edges:** email (`server/email.ts`), storage (`server/storage.ts`) and the rate limiter can be swapped without touching callers. Payment, WhatsApp and AI providers are not wired yet.
- Platform fee (bps) and RFQ expiry live in the `PlatformSetting` table.
