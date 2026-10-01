# CLAUDE.md

Guidance for Claude working in this repo. Read README.md and docs/ (DEPLOYMENT.md, LAUNCH-CHECKLIST.md, PRODUCT-FLOW.md, TESTING.md) before structural changes.

## What this is

Building Materials Network (BuildSource): a B2B marketplace and SaaS for the building-materials industry (search → suppliers → get 3 quotes → compare → order → review). npm workspaces monorepo:

- `apps/web` (`@bmn/web`): Next.js 16 App Router, TypeScript, Tailwind 4, Auth.js v5, vitest tests in `apps/web/tests`, browser e2e in `apps/web/e2e`.
- `packages/database` (`@bmn/database`): Prisma 7 schema, migrations and seeds. The client is generated into `packages/database/src/generated` and is not committed.
- `packages/config` (`@bmn/config`): shared config.

PostgreSQL in production, deployed to Vercel (see `vercel.json`, docs/DEPLOYMENT.md).

## Current merge policy

`main` is the default and production branch. Work on a feature branch (`feat/*`, `fix/*` or `claude/*`) and open a PR into `main`. Never push to `main` directly and never merge yourself unless a human asks in that specific request.

## Before calling anything done

CI (`.github/workflows/ci.yml`) runs these, in this order, against a Postgres 16 service:

```
npm ci
npm run db:generate      # required first: typecheck fails without the generated Prisma client
npm run format:check
npm run typecheck
npm run lint
npm test                 # DB integration tests need TEST_DATABASE_URL; without it they fail with ECONNREFUSED
npm run build
```

Locally, point `DATABASE_URL` and `TEST_DATABASE_URL` at a throwaway Postgres (CI uses `postgresql://bmn:bmn_local_dev@localhost:5432/bmn_test`). `tests/xlsx.test.ts` runs extra cases only when `python3` with `openpyxl` and/or LibreOffice (`/usr/bin/soffice`) are present. The LibreOffice case fails in sandboxes where soffice can't load files, which is an environment issue, not a code bug.

## Invariants

- **Organization-scoped access**: every company-owned record is scoped to the caller's organization server-side. Cross-company access must 404 (there are tests for this). Platform admins (`isPlatformAdmin`) need no organization.
- **Derived balances**: customer balances come from invoices and payments, never from a stored total. Stock comes from the append-only movement ledger. Don't add mutable shortcuts.
- **Schema changes go through Prisma migrations** in `packages/database`. No destructive migrations without approval.
- **Security overrides**: `package.json` `overrides` pins `mysql2` and `deepmerge-ts` to fix High advisories. Keep them until the upstream Prisma packages ship fixed versions.
- **Never commit secrets**: use `.env` (see `.env.example`). `.env*` files are gitignored.

## Current state (2026-10-01)

- `main` CI is green. Phase 1 core loop is done, and Phase 2 (admin panel, verification, inventory, delivery, customers and credit, volume pricing, plans and usage, BOQ, blog, branches, RFQ attachments) is built. See README.md.
- Open PRs: none apart from the repo-setup PR that added this file. Open issues: none.
- Remote branches `feat/blog`, `feat/branches` and `feat/rfq-attachments` aren't ancestors of `main`, but their features are on `main` (they landed through "Add files via upload" commits). They look superseded, but confirm with the owner before deleting them.
- Not built (needs a provider and keys): WhatsApp notifications, online subscription payment (plans are activated manually by an admin), AI-generated BOQ.
- Repo hygiene added: Dependabot (npm + github-actions, weekly), CodeQL workflow, SECURITY.md.

## Next steps

1. Triage the first weekly Dependabot PRs. Don't merge major bumps without testing.
2. Review the first CodeQL results in the Security tab.
3. Work through docs/LAUNCH-CHECKLIST.md manual checks (real email delivery, Supabase Storage upload, PWA install, Lighthouse).
4. Add browser e2e coverage for the post-launch features listed in docs/TESTING.md.

## Scope

Keep PRs focused on what was asked, and list anything you noticed but didn't fix in the PR description. Flag anything ambiguous about auth, org isolation, payments or migrations instead of guessing.
