# Launch checklist

Work through this top to bottom. Each item is something only you can do or confirm.

## 1. Merge the stack

Pull requests #2 to #14 are stacked: each targets the branch of the one before it. Merge them in numeric order (or retarget each to `main` after its parent merges). Then, once, on `main`:

```
npm ci
npm run db:generate
npm run format        # CI runs format:check and older files were never formatted
npm run typecheck && npm test && npm run build
```

Commit the formatting result as its own commit.

## 2. Repository hygiene

- Add `.uploads` and `.uploads-private` to `.gitignore` (local-disk upload folders).
- Add `SUPABASE_PRIVATE_BUCKET="private-files"` to `.env.example`.

## 3. Database

`npx prisma migrate deploy` applies, in order, everything up to `20261006000000_blog`. Do not run the demo seed in production. Create the first platform admin by registering normally, then setting `isPlatformAdmin` on that user in the database.

## 4. Storage

Create two Supabase buckets: a public one for product and logo images (`SUPABASE_STORAGE_BUCKET`) and a private one, `private-files` (`SUPABASE_PRIVATE_BUCKET`), for RFQ attachments. The private bucket must not be public; downloads are served through an authorised route.

## 5. Environment and health

Set the variables from `.env.example` in Vercel. After deploy, call `GET /api/health` with `Authorization: Bearer <CRON_SECRET>`; it lists any missing or weak variables (names only). Without the header it returns just `{"ok":true|false}`, suitable for an uptime monitor.

## 5b. Optional: AI BOQ drafting

Set `ANTHROPIC_API_KEY` in Vercel to enable "Draft a bill with AI" on project pages (leave it unset and the card says the feature is not enabled). `ANTHROPIC_MODEL` overrides the default model id. Drafts are capped per 30 days by plan (Free 3, Starter 30, SME 150; see `lib/ai-boq.ts`) and cost real API usage, so set a spend limit in the Anthropic console. Nothing the model returns is saved until the user reviews and confirms it.

## 6. Smoke test on staging

Register a buyer and a supplier; verify email; post an RFQ with an attachment; quote; accept; receive stock; reserve it on the order; transfer between two warehouses; request a plan and approve it as admin; publish a blog post; check `/sitemap.xml`, `/manufacturers`, `/blog`; with the AI key set, draft a bill from a project description and add two lines.

## 7. Known limitations

- Rate limiting is in memory, per server instance. Replace with Upstash or Redis before real traffic.
- Plan activation is manual (admin approves a request); there is no online payment.
- No WhatsApp or AI features.
- Database-backed tests and the browser flow were not run in the build environment; CI is the first place they run.
