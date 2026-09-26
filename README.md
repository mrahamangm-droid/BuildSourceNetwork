# Building Materials Network

B2B marketplace and SaaS for the building-materials industry: **Search → Find suppliers → Get 3 quotes → Compare → Order → Review.**
Stack: Next.js 16 (App Router), TypeScript, Tailwind 4, PostgreSQL, Prisma 7, Auth.js v5, Vercel.

## Built so far (Phase 1 core loop)

Authentication (sign up, login, logout, email verification, forgot/reset password), roles and organization-scoped access, supplier/store/contractor/buyer onboarding, company profile with logo and cover upload, product catalogue (units, MOQ, wholesale/contractor price, VAT, price history), public marketplace with search and filters, supplier/store public profiles with trust metrics, **RFQ + Get 3 Quotes** with supplier matching, supplier quote response, **side-by-side comparison**, accept → order, order status flow, reviews after completed orders, in-app and email notifications, role dashboards, SEO (metadata, JSON-LD, sitemap, robots, category/city pages), PWA manifest.

Phase 2 (in progress): **admin panel** (`/admin`: overview, verification queue, companies with suspend/revoke, platform settings) and **company verification** (`/dashboard/verification` → admin approve/reject → Verified badge, audit-logged, notifies the company). Admin accounts need no organization; set `isPlatformAdmin` on a user.

Inventory (Step 15): per-warehouse stock with reservations, receipts, issues, stock takes, low-stock flags and an append-only movement ledger (/dashboard/inventory); marketplace availability follows stock automatically.

Delivery (Step 14): suppliers schedule deliveries per order (date, driver, vehicle, address), move them Awaiting driver → Driver assigned → Out for delivery → Delivered with a required recipient name and optional proof photo; the order status follows, and buyers are notified at each step (/dashboard/deliveries).

Customers & credit (Step 16): a seller's own customer book with credit limits and payment terms, invoices (auto-numbered INV-YYYY-NNNN, VAT, due dates), payments (on account or against an invoice), ageing buckets and a running-balance statement (/dashboard/customers). Balances are always derived from invoices and payments; over-limit invoices are blocked unless an owner/admin overrides; voids are owner/admin only and audit-logged.

Volume pricing (Step 12): sellers can add up to six quantity price breaks per product (/dashboard/products/[id]/pricing). Breaks must sit above the minimum order, be strictly cheaper than the base price and than every smaller tier, and are enforced in code and by a DB CHECK; the public product page shows the tier table with savings, and the resolver never charges more than the base price if a break goes stale.

Stock on orders: a supplier links order lines to their own products (same unit) to reserve stock once an order is confirmed. Dispatching (or sending a delivery out) issues the reserved goods, cancelling releases them, and both are idempotent per line, recorded in the stock ledger against the order number. Automatic sync never blocks an order: failures are audited and the supplier can retry from the order page.

Plans & usage (Step 21): /dashboard/billing shows the current plan, usage against product and RFQ limits, and lets an owner or admin request a paid plan. Online payment is NOT connected: a platform admin confirms payment outside the platform, records the reference and activates the plan for 30 days at /admin/plans. Limits are enforced from one place; when a paid period lapses (7-day grace) Free limits apply, and nothing is deleted on a downgrade.

Manufacturer portal (Step 8): rather than a fifth organization type (which would touch every permission check), a supplier declares a kind (manufacturer, distributor or wholesaler) plus lead time, minimum order, capacity and self-declared certifications in /dashboard/profile. Manufacturers get a public directory at /manufacturers and a "Factory details" card on their profile. Certifications are labelled self-declared; nothing is verified automatically.

RFQ attachments (Step 6): a buyer can attach up to 5 files (PDF, PNG/JPG, XLSX, DOCX, DWG; 4 MB each, checked by extension and file signature) to an open RFQ. Files are private: stored in a separate private bucket (`SUPABASE_PRIVATE_BUCKET`, must be created as private) and served only through `/api/rfq-attachments/[id]`, which allows the buyer org and the suppliers the RFQ was sent to. The 4 MB cap keeps requests under the Vercel body limit. Files are not virus-scanned, and objects of a deleted RFQ are not purged from storage.

Projects & BOQ (Step 17): contractors and buyers keep projects with a priced bill of quantities (waste allowance, per-section subtotals, budget variance, CSV export that neutralises spreadsheet formulas) at /dashboard/projects. The starter bill is a transparent rule-based estimate from floor area and project type, not machine learning and not a drawing take-off; its assumptions are listed in the UI. Ticked BOQ lines can be sent as a quote request: they pre-fill the RFQ form with order quantities (waste included), a guessed category and unit where the match is confident, and blanks where it is not; the buyer edits everything before sending.

Not built yet (spec phases 2–4): pricing engine beyond price tiers, projects/BOQ/AI, calculators, blog, subscription billing, multi-branch, RFQ file attachments.

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
