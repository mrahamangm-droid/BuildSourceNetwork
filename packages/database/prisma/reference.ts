/**
 * Reference data every environment needs: categories, units, subscription plans and
 * platform settings. Idempotent (upserts only) and free of demo data, so it is safe to run
 * on every production deploy. Sign-up fails without the FREE plan row.
 */
import { CATEGORIES, PLANS, TAXONOMY, UNITS, slugify } from "@bmn/config";
import type { PrismaClient } from "../src/generated/client";

export async function seedReference(db: PrismaClient) {
  for (const [i, name] of CATEGORIES.entries()) {
    const slug = slugify(name);
    // Ordering and department are owned by syncTaxonomy below; only create what is missing here.
    await db.category.upsert({
      where: { slug },
      update: {},
      create: { slug, name, sortOrder: i },
    });
  }
  await syncTaxonomy(db);
  for (const u of UNITS) {
    await db.unit.upsert({
      where: { code: u.code },
      update: { name: u.name, dimension: u.dimension, baseCode: u.baseCode, factor: u.factor },
      create: {
        code: u.code,
        name: u.name,
        dimension: u.dimension,
        baseCode: u.baseCode,
        factor: u.factor,
      },
    });
  }
  for (const p of PLANS) {
    const data = {
      name: p.name,
      priceMonthlyCents: p.priceMonthlyCents,
      productLimit: p.productLimit,
      rfqLimit: p.rfqLimit,
      features: [...p.features],
    };
    await db.subscriptionPlan.upsert({
      where: { code: p.code },
      update: data,
      create: { code: p.code, ...data },
    });
  }
  for (const [key, value] of Object.entries({
    platformFeeBps: "100",
    rfqExpiryDays: "7",
    defaultCurrency: "AED",
  })) {
    await db.platformSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}

const chunks = <T>(list: T[], size = 500) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, i * size + size),
  );

/**
 * Brings Department → Category → Subcategory → Product type in line with the taxonomy in @bmn/config.
 * Idempotent and cheap on repeat runs: it reads each level once, creates only what is missing in bulk,
 * and updates only rows whose name, order or parent actually changed. Nothing is ever deleted, so
 * products keep their links even if a node is later dropped from the list.
 */
export async function syncTaxonomy(db: PrismaClient) {
  // Departments
  const deptRows = await db.department.findMany();
  const deptBySlug = new Map(deptRows.map((d) => [d.slug, d]));
  const newDepts = TAXONOMY.map((d, i) => ({ slug: d.slug, name: d.name, sortOrder: i })).filter(
    (d) => !deptBySlug.has(d.slug),
  );
  if (newDepts.length) await db.department.createMany({ data: newDepts, skipDuplicates: true });
  for (const [i, d] of TAXONOMY.entries()) {
    const row = deptBySlug.get(d.slug);
    if (row && (row.name !== d.name || row.sortOrder !== i))
      await db.department.update({ where: { id: row.id }, data: { name: d.name, sortOrder: i } });
  }
  const deptId = new Map((await db.department.findMany()).map((d) => [d.slug, d.id]));

  // Categories (ordered by department, then position)
  const catRows = await db.category.findMany();
  const catBySlug = new Map(catRows.map((c) => [c.slug, c]));
  let order = 0;
  const wantedCats = TAXONOMY.flatMap((d) =>
    d.categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      departmentId: deptId.get(d.slug)!,
      sortOrder: order++,
    })),
  );
  const newCats = wantedCats.filter((c) => !catBySlug.has(c.slug));
  if (newCats.length) await db.category.createMany({ data: newCats, skipDuplicates: true });
  for (const c of wantedCats) {
    const row = catBySlug.get(c.slug);
    if (row && (row.departmentId !== c.departmentId || row.sortOrder !== c.sortOrder))
      await db.category.update({
        where: { id: row.id },
        data: { departmentId: c.departmentId, sortOrder: c.sortOrder },
      });
  }
  const catId = new Map((await db.category.findMany()).map((c) => [c.slug, c.id]));

  // Subcategories
  const subRows = await db.subcategory.findMany();
  const subKey = (categoryId: string, slug: string) => `${categoryId}/${slug}`;
  const subByKey = new Map(subRows.map((s) => [subKey(s.categoryId, s.slug), s]));
  const wantedSubs = TAXONOMY.flatMap((d) =>
    d.categories.flatMap((c) =>
      c.subcategories.map((s, i) => ({
        categoryId: catId.get(c.slug)!,
        slug: s.slug,
        name: s.name,
        sortOrder: i,
      })),
    ),
  );
  const newSubs = wantedSubs.filter((s) => !subByKey.has(subKey(s.categoryId, s.slug)));
  for (const part of chunks(newSubs))
    await db.subcategory.createMany({ data: part, skipDuplicates: true });
  for (const s of wantedSubs) {
    const row = subByKey.get(subKey(s.categoryId, s.slug));
    if (row && (row.name !== s.name || row.sortOrder !== s.sortOrder))
      await db.subcategory.update({
        where: { id: row.id },
        data: { name: s.name, sortOrder: s.sortOrder },
      });
  }
  const subId = new Map(
    (await db.subcategory.findMany()).map((s) => [subKey(s.categoryId, s.slug), s.id]),
  );

  // Product types
  const typeRows = await db.productType.findMany();
  const typeByKey = new Map(typeRows.map((t) => [subKey(t.subcategoryId, t.slug), t]));
  const wantedTypes = TAXONOMY.flatMap((d) =>
    d.categories.flatMap((c) =>
      c.subcategories.flatMap((s) =>
        s.types.map((t, i) => ({
          subcategoryId: subId.get(subKey(catId.get(c.slug)!, s.slug))!,
          slug: t.slug,
          name: t.name,
          sortOrder: i,
        })),
      ),
    ),
  );
  const newTypes = wantedTypes.filter((t) => !typeByKey.has(subKey(t.subcategoryId, t.slug)));
  for (const part of chunks(newTypes))
    await db.productType.createMany({ data: part, skipDuplicates: true });
  for (const t of wantedTypes) {
    const row = typeByKey.get(subKey(t.subcategoryId, t.slug));
    if (row && (row.name !== t.name || row.sortOrder !== t.sortOrder))
      await db.productType.update({
        where: { id: row.id },
        data: { name: t.name, sortOrder: t.sortOrder },
      });
  }
}
