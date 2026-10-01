# CLAUDE.md

Guidance for Claude working in this repo.

## What this repo is

Building Materials Network (BuildSourceNetwork): a B2B marketplace and SaaS
for the building-materials industry. The core loop is search, find
suppliers, get 3 quotes, compare, order, review. npm workspaces monorepo:

- `apps/web`: Next.js 16 App Router, Tailwind 4, Auth.js v5
- `packages/database`: Prisma 7 + PostgreSQL (schema, migrations, seeds)
- `packages/config`: shared config

## Current state (2026-10-01)

- Phase 1 core loop is built. Phase 2 (admin panel, company verification)
  is in progress, along with inventory, delivery, customers & credit,
  volume pricing, plans & usage and the manufacturer portal (see README).
- Online payment, WhatsApp and AI providers are **not** wired yet.
- CI (`.github/workflows/ci.yml`, Postgres 16 service): `npm ci`,
  `db:generate`, `format:check`, `typecheck`, `lint`, `test`, `build`.
  It's green on `main`.
- `.github/dependabot.yml` (npm workspaces + github-actions, weekly) and
  `.github/workflows/codeql.yml` (TypeScript + workflows).
- Open PRs: none. Open issues: none. There are about 37 branches on the
  remote; many are probably merged and stale.

## Before calling anything done

Run what CI runs:

```
npm ci
npm run db:generate
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

`build` needs a reachable Postgres via `DATABASE_URL` (see `.env.example`).

## Invariants

- **Tenancy**: every private row carries an org id. Services take a `Ctx`
  (user, org, role) from `apps/web/src/server/ctx.ts` and always filter by
  it. Orders are visible only to the buying and supplying orgs, and RFQs
  only to the buyer and its recipients. Never trust an org id from the
  client.
- **Totals are computed server-side.** Quote acceptance is transactional
  and race-safe; keep it that way.
- **Inventory movements are an append-only ledger.** Correct them with new
  movements, never by editing or deleting rows.
- Email, storage and the rate limiter are pluggable (`server/email.ts`,
  `server/storage.ts`). Unconfigured providers must fail clearly, never
  fake success.
- Never commit secrets. Open a PR for every change; never push to `main`.

## Next steps

- Finish Phase 2 (admin panel, verification).
- Prune merged branches.
