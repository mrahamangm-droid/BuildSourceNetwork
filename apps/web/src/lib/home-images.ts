/**
 * Pre-optimised homepage photography (WebP, each file under 50 KB).
 * Licence and source notes live in docs/HOMEPAGE-IMAGES.md.
 * Widths/heights describe the intrinsic size of each file and are used for srcset and CLS-safe sizing.
 */
export type HomeImageKey =
  | "hero-dubai-skyline-construction"
  | "hero-contractor-supplier-handshake"
  | "hero-modern-home-architecture"
  | "supplier-warehouse-racking"
  | "contractors-site-walkthrough"
  | "builders-reviewing-plans"
  | "modern-villa-pool"
  | "concrete-blocks-stacked"
  | "steel-rebar-coils"
  | "timber-planks-stack"
  | "aggregate-dump-truck-delivery"
  | "clay-bricks-masonry";

export type HomeImage = {
  alt: string;
  variants: { w: number; h: number }[];
};

export const HOME_IMAGES: Record<HomeImageKey, HomeImage> = {
  "hero-dubai-skyline-construction": {
    alt: "Dubai skyline with high-rise towers and tower cranes, where developers source construction materials",
    variants: [
      { w: 960, h: 600 },
      { w: 640, h: 400 },
      { w: 400, h: 250 },
    ],
  },
  "hero-contractor-supplier-handshake": {
    alt: "Contractor and building-materials supplier shaking hands beside precast concrete slabs",
    variants: [
      { w: 800, h: 600 },
      { w: 520, h: 390 },
      { w: 340, h: 255 },
    ],
  },
  "hero-modern-home-architecture": {
    alt: "Modern two-storey home with a swimming pool, built with quality construction materials",
    variants: [
      { w: 800, h: 600 },
      { w: 520, h: 390 },
      { w: 340, h: 255 },
    ],
  },
  "supplier-warehouse-racking": {
    alt: "Building-materials supplier warehouse with roof tiles and timber pallets on steel racking",
    variants: [
      { w: 640, h: 480 },
      { w: 440, h: 330 },
      { w: 300, h: 225 },
    ],
  },
  "contractors-site-walkthrough": {
    alt: "Contractors in hard hats and high-visibility vests walking a reinforced concrete slab on site",
    variants: [
      { w: 640, h: 480 },
      { w: 440, h: 330 },
      { w: 300, h: 225 },
    ],
  },
  "builders-reviewing-plans": {
    alt: "Builders reviewing architectural plans together on a construction site",
    variants: [
      { w: 800, h: 600 },
      { w: 640, h: 480 },
      { w: 440, h: 330 },
      { w: 300, h: 225 },
    ],
  },
  "modern-villa-pool": {
    alt: "Modern white villa with a pool and covered terrace",
    variants: [
      { w: 800, h: 600 },
      { w: 640, h: 480 },
      { w: 440, h: 330 },
      { w: 300, h: 225 },
    ],
  },
  "concrete-blocks-stacked": {
    alt: "Stacks of strapped concrete blocks on pallets in a supplier yard",
    variants: [
      { w: 800, h: 600 },
      { w: 640, h: 480 },
      { w: 440, h: 330 },
      { w: 300, h: 225 },
    ],
  },
  "steel-rebar-coils": {
    alt: "Coils of steel reinforcement bar (rebar) for concrete construction",
    variants: [
      { w: 800, h: 600 },
      { w: 640, h: 480 },
      { w: 440, h: 330 },
      { w: 300, h: 225 },
    ],
  },
  "timber-planks-stack": {
    alt: "Stacked sawn timber planks for construction and joinery",
    variants: [
      { w: 800, h: 600 },
      { w: 640, h: 480 },
      { w: 440, h: 330 },
      { w: 300, h: 225 },
    ],
  },
  "aggregate-dump-truck-delivery": {
    alt: "Tipper truck unloading aggregate at a stockpile for construction delivery",
    variants: [
      { w: 800, h: 600 },
      { w: 640, h: 480 },
      { w: 440, h: 330 },
      { w: 300, h: 225 },
    ],
  },
  "clay-bricks-masonry": {
    alt: "Clay bricks and pavers for masonry and paving work",
    variants: [
      { w: 800, h: 600 },
      { w: 640, h: 480 },
      { w: 440, h: 330 },
      { w: 300, h: 225 },
    ],
  },
};

export const homeImagePath = (key: HomeImageKey, w: number) => `/images/home/${key}-${w}.webp`;
