/**
 * Seed: reference data (categories, units, plans) + clearly-marked DEMO data.
 * Every demo row has isDemo = true and demo organizations are never marked verified.
 * Run: npm run db:seed   (safe to re-run; reference data is upserted, demo data is rebuilt)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { CATEGORIES } from "@bmn/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/client";
import { seedReference } from "./reference";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Demo@12345";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@demo.bmn.example";

type Cat = (typeof CATEGORIES)[number];

const SUPPLIERS = [
  {
    name: "Gulf Cement Trading (Demo)",
    city: "Sharjah",
    cats: ["Cement", "Blocks", "Sand", "Gravel"] as Cat[],
  },
  {
    name: "Emirates Steel Depot (Demo)",
    city: "Dubai",
    cats: ["Steel", "Hardware", "Tools"] as Cat[],
  },
  {
    name: "Al Noor Tiles & Sanitary (Demo)",
    city: "Ajman",
    cats: ["Tiles", "Sanitaryware", "Plumbing"] as Cat[],
  },
  {
    name: "Desert Block Industries (Demo)",
    city: "Sharjah",
    cats: ["Blocks", "Cement", "Gypsum"] as Cat[],
  },
  {
    name: "Falcon Paints & Coatings (Demo)",
    city: "Dubai",
    cats: ["Paint", "Waterproofing", "Insulation"] as Cat[],
  },
  {
    name: "Capital Building Supplies (Demo)",
    city: "Abu Dhabi",
    cats: ["Cement", "Steel", "Electrical", "Safety materials"] as Cat[],
  },
];

// name, category, unit, price (AED), moq, brand, packageSize
type P = [string, Cat, string, number, number, string | null, string | null];
const CATALOG: Record<string, P[]> = {
  "Gulf Cement Trading (Demo)": [
    ["Ordinary Portland Cement 50kg", "Cement", "BAG", 17.5, 100, "DemoCem", "50 kg bag"],
    ["Sulphate Resistant Cement 50kg", "Cement", "BAG", 19.75, 100, "DemoCem", "50 kg bag"],
    ["Washed Sharp Sand", "Sand", "TON", 62, 10, null, null],
    ["Crushed Gravel 20mm", "Gravel", "TON", 68, 10, null, "20 mm"],
    ["Hollow Concrete Block 6 inch", "Blocks", "PIECE", 2.6, 1000, "DemoBlock", "40x20x15 cm"],
  ],
  "Emirates Steel Depot (Demo)": [
    ["Rebar 12mm B500B", "Steel", "TON", 2350, 5, "DemoSteel", "12 m bars"],
    ["Rebar 16mm B500B", "Steel", "TON", 2320, 5, "DemoSteel", "12 m bars"],
    ["Rebar 20mm B500B", "Steel", "TON", 2310, 5, "DemoSteel", "12 m bars"],
    ["Binding Wire 1.6mm", "Hardware", "ROLL", 95, 5, null, "25 kg roll"],
    ["Angle Grinder 850W", "Tools", "PIECE", 189, 1, "DemoTools", null],
  ],
  "Al Noor Tiles & Sanitary (Demo)": [
    ["Porcelain Floor Tile 60x60 Matt Grey", "Tiles", "SQM", 38, 50, "DemoTile", "60x60 cm"],
    ["Ceramic Wall Tile 30x60 White", "Tiles", "SQM", 26, 50, "DemoTile", "30x60 cm"],
    ["Wall-hung WC Set", "Sanitaryware", "SET", 620, 1, "DemoBath", null],
    ["PPR Pipe 25mm PN20", "Plumbing", "METER", 6.5, 100, null, "4 m length"],
    ["Basin Mixer Tap Chrome", "Sanitaryware", "PIECE", 145, 1, "DemoBath", null],
  ],
  "Desert Block Industries (Demo)": [
    ["Solid Concrete Block 4 inch", "Blocks", "PIECE", 1.9, 2000, "DemoBlock", "40x20x10 cm"],
    ["Hollow Concrete Block 6 inch", "Blocks", "PIECE", 2.55, 1000, "DemoBlock", "40x20x15 cm"],
    ["Hollow Concrete Block 8 inch", "Blocks", "PIECE", 3.3, 1000, "DemoBlock", "40x20x20 cm"],
    ["Gypsum Board 12.5mm", "Gypsum", "PIECE", 24, 50, "DemoGyp", "1200x2400 mm"],
    ["Ordinary Portland Cement 50kg", "Cement", "BAG", 17.9, 200, "DemoCem", "50 kg bag"],
  ],
  "Falcon Paints & Coatings (Demo)": [
    ["Exterior Emulsion Paint White 18L", "Paint", "LITER", 12.4, 18, "DemoPaint", "18 L pail"],
    ["Interior Emulsion Paint White 18L", "Paint", "LITER", 9.8, 18, "DemoPaint", "18 L pail"],
    ["Cementitious Waterproofing Slurry 20kg", "Waterproofing", "BAG", 118, 5, "DemoSeal", "20 kg"],
    ["XPS Insulation Board 50mm", "Insulation", "SQM", 31, 20, "DemoTherm", "600x1200 mm"],
    ["Bitumen Membrane 4mm", "Waterproofing", "ROLL", 165, 10, "DemoSeal", "10 m roll"],
  ],
  "Capital Building Supplies (Demo)": [
    ["Ordinary Portland Cement 50kg", "Cement", "BAG", 18.2, 100, "DemoCem", "50 kg bag"],
    ["Rebar 16mm B500B", "Steel", "TON", 2365, 5, "DemoSteel", "12 m bars"],
    ["Safety Helmet Yellow", "Safety materials", "PIECE", 14, 20, "DemoSafe", null],
    ["Copper Cable 3x2.5mm", "Electrical", "METER", 7.8, 100, null, "100 m drum"],
    ["MCB 32A Single Pole", "Electrical", "PIECE", 21, 10, "DemoElec", null],
  ],
};

async function wipeDemo() {
  const demoOrgs = await db.organization.findMany({
    where: { isDemo: true },
    select: { id: true },
  });
  const ids = demoOrgs.map((o) => o.id);
  if (ids.length) {
    await db.order.deleteMany({
      where: { OR: [{ buyerOrgId: { in: ids } }, { supplierOrgId: { in: ids } }] },
    });
    await db.rfq.deleteMany({ where: { buyerOrgId: { in: ids } } });
    await db.organization.deleteMany({ where: { id: { in: ids } } });
  }
  await db.user.deleteMany({ where: { isDemo: true } });
}

async function makeUser(email: string, name: string, extra: { isPlatformAdmin?: boolean } = {}) {
  return db.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      emailVerifiedAt: new Date(),
      isDemo: true,
      ...extra,
    },
  });
}

async function makeOrg(
  type: "SUPPLIER" | "STORE" | "CONTRACTOR" | "BUYER",
  name: string,
  city: string,
  ownerEmail: string,
  cats: Cat[] = [],
) {
  const slug = slugify(name);
  const owner = await makeUser(ownerEmail, `${name} Owner`);
  const catRows = await db.category.findMany({ where: { name: { in: cats } } });
  const org = await db.organization.create({
    data: {
      type,
      name,
      slug,
      isDemo: true,
      city,
      region: city,
      description: `Demo ${type.toLowerCase()} profile for showcasing the platform. This is not a real business.`,
      email: ownerEmail,
      phone: "+971 00 000 0000",
      businessHours: "Sat–Thu 8:00–18:00",
      deliveryAreas: type === "SUPPLIER" ? ["Sharjah", "Dubai", "Ajman", "Umm Al Quwain"] : [],
      verificationStatus: "UNVERIFIED",
      categories: { connect: catRows.map((c) => ({ id: c.id })) },
      members: { create: { userId: owner.id, role: "OWNER" } },
      subscription: { create: { planCode: type === "SUPPLIER" ? "STARTER" : "FREE" } },
    },
  });
  return { org, owner };
}

async function main() {
  await seedReference(db);
  await wipeDemo();
  const units = await db.unit.findMany();
  const cats = await db.category.findMany();
  const catByName = new Map(cats.map((c) => [c.name, c.id]));

  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { isPlatformAdmin: true },
    create: {
      email: ADMIN_EMAIL,
      name: "Demo Platform Admin",
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      emailVerifiedAt: new Date(),
      isPlatformAdmin: true,
      isDemo: true,
    },
  });

  const supplierOrgs: { id: string; name: string }[] = [];
  for (const [i, s] of SUPPLIERS.entries()) {
    const { org } = await makeOrg(
      "SUPPLIER",
      s.name,
      s.city,
      `supplier${i + 1}@demo.bmn.example`,
      s.cats,
    );
    supplierOrgs.push(org);
    for (const [pi, [name, cat, unit, price, moq, brand, pack]] of CATALOG[s.name].entries()) {
      if (!units.find((u) => u.code === unit)) throw new Error("unknown unit " + unit);
      const brandRow = brand
        ? await db.brand.upsert({
            where: { slug: slugify(brand) },
            update: {},
            create: { slug: slugify(brand), name: brand },
          })
        : null;
      const product = await db.product.create({
        data: {
          orgId: org.id,
          categoryId: catByName.get(cat)!,
          brandId: brandRow?.id,
          unitCode: unit,
          sku: `${slugify(s.name).slice(0, 3).toUpperCase()}${i + 1}-${String(pi + 1).padStart(3, "0")}`,
          name,
          slug: slugify(name),
          description: `${name} supplied by ${s.name}. Demo listing — prices are illustrative only.`,
          packageSize: pack,
          minOrderQty: moq,
          price,
          wholesalePrice: Math.round(price * 0.96 * 100) / 100,
          contractorPrice: Math.round(price * 0.94 * 100) / 100,
          city: s.city,
          stockStatus: i % 4 === 3 ? "ON_REQUEST" : "IN_STOCK",
          deliveryAvailable: true,
          isDemo: true,
          prices: { create: { price, tier: "RETAIL" } },
        },
      });
      void product;
    }
  }

  const store = await makeOrg(
    "STORE",
    "Sunrise Hardware Store (Demo)",
    "Sharjah",
    "store1@demo.bmn.example",
  );
  const contractor = await makeOrg(
    "CONTRACTOR",
    "Skyline Contracting LLC (Demo)",
    "Dubai",
    "contractor1@demo.bmn.example",
  );
  await makeOrg("BUYER", "Harbor View Developments (Demo)", "Abu Dhabi", "buyer1@demo.bmn.example");

  // A demo RFQ with two quotes and one accepted order so dashboards have real data.
  const cement = catByName.get("Cement")!;
  const rfq = await db.rfq.create({
    data: {
      number: "RFQ-DEMO-0001",
      buyerOrgId: contractor.org.id,
      createdById: contractor.owner.id,
      title: "Cement for Villa Block A (Demo)",
      deliveryCity: "Sharjah",
      requiredDate: new Date(Date.now() + 10 * 864e5),
      expiresAt: new Date(Date.now() + 7 * 864e5),
      isGetQuotes: true,
      isDemo: true,
      items: {
        create: [
          {
            categoryId: cement,
            name: "Ordinary Portland Cement 50kg",
            quantity: 500,
            unitCode: "BAG",
          },
        ],
      },
    },
    include: { items: true },
  });
  const quoters = [
    { org: supplierOrgs[0], price: 17.5, days: 2 },
    { org: supplierOrgs[3], price: 17.9, days: 1 },
    { org: supplierOrgs[5], price: 18.2, days: 3 },
  ];
  for (const [i, q] of quoters.entries()) {
    await db.rfqRecipient.create({
      data: {
        rfqId: rfq.id,
        supplierOrgId: q.org.id,
        status: i < 2 ? "RESPONDED" : "VIEWED",
        viewedAt: new Date(),
        respondedAt: i < 2 ? new Date() : null,
      },
    });
    if (i < 2) {
      await db.quote.create({
        data: {
          rfqId: rfq.id,
          supplierOrgId: q.org.id,
          deliveryDays: q.days,
          deliveryCost: 150,
          validUntil: new Date(Date.now() + 5 * 864e5),
          totalAmount: q.price * 500 + 150,
          status: i === 0 ? "ACCEPTED" : "SUBMITTED",
          items: {
            create: {
              rfqItemId: rfq.items[0].id,
              unitPrice: q.price,
              quantityAvailable: 500,
              minOrderQty: 100,
            },
          },
        },
      });
    }
  }
  const acceptedQuote = await db.quote.findFirstOrThrow({
    where: { rfqId: rfq.id, status: "ACCEPTED" },
  });
  await db.rfq.update({ where: { id: rfq.id }, data: { status: "ACCEPTED" } });
  await db.order.create({
    data: {
      number: "ORD-DEMO-0001",
      buyerOrgId: contractor.org.id,
      supplierOrgId: acceptedQuote.supplierOrgId,
      rfqId: rfq.id,
      quoteId: acceptedQuote.id,
      createdById: contractor.owner.id,
      status: "CONFIRMED",
      subtotal: 8750,
      deliveryCost: 150,
      totalAmount: 8900,
      deliveryCity: "Sharjah",
      isDemo: true,
      items: {
        create: {
          name: "Ordinary Portland Cement 50kg",
          quantity: 500,
          unitCode: "BAG",
          unitPrice: 17.5,
          lineTotal: 8750,
        },
      },
      events: { create: [{ status: "ORDER_CREATED" }, { status: "CONFIRMED" }] },
    },
  });
  void store;

  console.log(`Seeded. Demo login password for all demo users: ${DEMO_PASSWORD}`);
  console.log(
    "Demo accounts: supplier1..6@, store1@, contractor1@, buyer1@, admin@ (demo.bmn.example)",
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
