# Homepage photography

Twelve photographs power the homepage (hero collage, "Shop by material" tiles and "Built for every side of the build" cards). They live in `apps/web/public/images/home/` and are described in `apps/web/src/lib/home-images.ts` (alt text and intrinsic sizes). The `HomePicture` component renders them with `<picture>`, `srcset`/`sizes`, intrinsic `width`/`height` and lazy loading (only the first hero image is eager with `fetchpriority="high"`).

Image IDs and the size budget below are the source of truth for the homepage photos.

## Licence

All photos come from the free Unsplash library. The Unsplash License (https://unsplash.com/license, checked 2026-10-07) allows free use, including commercial use, without permission or attribution. It does not allow selling the unmodified images or compiling them into a competing photo service. Unsplash+ (premium) images were deliberately not used, and images showing readable third-party company logos were skipped.

| File prefix                        | Unsplash CDN id                  |
| ---------------------------------- | -------------------------------- |
| hero-dubai-skyline-construction    | photo-1745750434535-5943ef2fd31a |
| hero-contractor-supplier-handshake | photo-1742112125635-6f8201c6ee3f |
| hero-modern-home-architecture      | photo-1580587771525-78b9dba3b914 |
| supplier-warehouse-racking         | photo-1637056930633-b862109dbdbe |
| contractors-site-walkthrough       | photo-1541888946425-d81bb19240f5 |
| builders-reviewing-plans           | photo-1632862378103-8248dccb7e3d |
| modern-villa-pool                  | photo-1613977257363-707ba9348227 |
| concrete-blocks-stacked            | photo-1762608675529-c7454690ff75 |
| steel-rebar-coils                  | photo-1763771421047-7363eeece6f7 |
| timber-planks-stack                | photo-1422246654994-34520d5a0340 |
| aggregate-dump-truck-delivery      | photo-1760568787655-247d67618f37 |
| clay-bricks-masonry                | photo-1623025269255-698eff8ab9c2 |

To find a photographer credit (optional), search the CDN id on unsplash.com.

## Optimisation

Each photo is cropped (16:10 for the main hero, 4:3 elsewhere), resized to 3-4 widths and encoded as WebP with the highest quality that stays under 48 KB per file (43 files). Crops match the earlier set.

The masters are the full-size Unsplash originals (`images.unsplash.com/<id>?w=2400`), not the earlier ~1316 px captures. Because of the 50 KB budget, extra resolution only helps where the photo compresses well: the 4:3 cards and small heroes now have an 800 px variant (WebP quality 66-85), while the main hero stays at 960 px (quality 40) and the warehouse and site-walkthrough cards stay at 640 px, since larger sizes cannot fit the budget at acceptable quality. Raising the budget (for example to 80-100 KB) is the way to get a sharper hero.

To refresh again, re-download the originals by the ids above and re-encode with the same size budget.
