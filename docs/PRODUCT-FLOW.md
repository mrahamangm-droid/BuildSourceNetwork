# Product flow and smart features

Main flow: **Find → Compare → Request → Choose → Order → Deliver**.

| Feature                       | Where                                     | How it works                                                                                                                                                                                                                                                           |
| ----------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smart Material Matching       | `/match`                                  | Scores active products against a free-text need (keywords, stock, delivery city, verification, minimum order, price vs. median) and keeps the best product per supplier. Every result shows its reasons. Logic: `src/lib/match.ts`.                                    |
| One RFQ → multiple quotes     | `/dashboard/rfqs/new`                     | Existing. "Get 3 Quotes" sends one request to the 3–5 best-matching suppliers.                                                                                                                                                                                         |
| Supplier comparison           | RFQ detail (buyer)                        | Price, availability, delivery, MOQ, verification, role and location side by side. "Best value" weighs price 45 %, delivery 20 %, quantity coverage 20 %, verification 10 %, same city 5 % (`src/lib/compare.ts`). It is a guide, not a decision.                       |
| Smart Alternatives            | Product page, RFQ detail                  | Same category and unit, ranked by stock, brand, matching specifications, price, delivery area and verification (`src/lib/alternatives.ts`). Out-of-stock items are never suggested.                                                                                    |
| Project procurement workspace | Project page                              | RFQs raised from a BOQ are linked to the project (`Rfq.projectId`). The page shows BOQ → RFQs → Quotes → Orders → Delivery and the spend split across suppliers. RFQs created before this feature are not linked.                                                      |
| BOQ upload and extraction     | Project page                              | Paste rows or upload .csv/.tsv/.txt (≤ 200 KB, ≤ 200 lines). Columns are detected automatically; free-text lines like "Cement 42.5N - 200 bags" also work. Nothing is saved until the user reviews it. Deterministic: no AI cost. (The optional AI draft is separate.) |
| Multi-supplier procurement    | Project page                              | Send separate RFQs for different BOQ lines; orders from different suppliers roll up in the one project. Awarding individual lines of one RFQ to different suppliers is not built: a quote is accepted as a whole.                                                      |
| Supplier mini-store           | `/suppliers/[slug]`, `/stores/[slug]`     | Existing public storefront for every active supplier and store.                                                                                                                                                                                                        |
| Regular materials and reorder | Orders page, order detail                 | Derived from the buyer's own order history (nothing extra stored). "Reorder" copies an order's lines into a new RFQ, to the same supplier or to new quotes.                                                                                                            |
| Verified supply chain         | Product, supplier and store pages, quotes | Shows Manufacturer → Supplier → Store → Contractor/Developer with the organization's position (from account type and supplier kind) and whether it is admin-verified.                                                                                                  |

## Company details

`src/lib/company.ts` is the single source of truth (PAPPLE WORLD FZE LLC, RAK, UAE, support@BuildSourceNetwork.com). It feeds the footer, contact page, structured data and the footer of every outgoing email.

## Brand assets

`public/brand/` holds the SVG mark, horizontal logos (light and dark) and transparent PNGs. `src/app/icon.svg`, `favicon.ico`, `apple-icon.png` and `opengraph-image.png` are picked up by Next.js automatically. The in-app logo is `src/components/layout/logo.tsx`.

## Deploy note

This release adds one additive migration (`20261007000000_rfq_project`, a nullable `Rfq.projectId`). The Vercel production build applies it automatically.
