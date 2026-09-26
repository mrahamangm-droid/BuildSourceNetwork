# Testing checklist

Automated (run in CI):

- `npm test` — pure-logic unit tests (pricing, stock math, plans, BOQ, markdown, attachments, branches, env check) plus integration tests against a real Postgres (`TEST_DATABASE_URL`; these are skipped without it): registration, email verification, password reset, role permissions, organization isolation, product create/validation/archive/price history, marketplace search and filters, RFQ + supplier matching, quotes, comparison order, accept → order, double-accept race (exactly one order), order transitions by role, reviews, expiry, notifications, dashboard stats.
- `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm run build`.

Browser end-to-end (`apps/web/e2e/full-flow.mjs`, needs a running production server):

```
npm run build && npm start > server.log &     # mail is logged when EMAIL_PROVIDER is unset
BASE_URL=http://localhost:3000 SERVER_LOG=server.log node apps/web/e2e/full-flow.mjs
```

Covers: visitor → search → product → supplier → Request Quotes (login redirect) → supplier onboarding + product → RFQ (Get 3 Quotes) → supplier quote → comparison → accept → order → delivery steps → completion → review → public profile metrics; cross-company 404s; login/logout; password reset; mobile (390px) overflow checks.

Manual checks before launch: real email delivery, image upload against Supabase Storage, PWA install on Android/iOS, Lighthouse on `/` and `/marketplace`, iPhone Safari layout.

Manual checks per feature added after the first release (none of these have browser tests yet): stock receipt/issue/adjust and the ledger; delivery notes and customer credit; price breaks in the RFQ flow; BOQ to RFQ conversion; reserving stock from an order and transferring between warehouses; plan request and admin activation; RFQ attachment upload, download by the other party, and 404 for an unrelated company; blog draft, publish, unpublish and sitemap entry; `/manufacturers` filters.

Not built (need a provider and keys): WhatsApp notifications, online subscription payment, AI-generated BOQ.
