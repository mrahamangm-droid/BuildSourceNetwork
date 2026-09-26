import { db } from "@bmn/database";
import { AppError } from "../errors";
import { fieldErrorsFrom } from "./accounts";
import { audit } from "./notify";
import { assertAdmin, type AdminActor } from "./admin";
import { parseTags, slugify } from "@/lib/markdown";
import { postSchema } from "@/lib/blog";
import { STARTER_POSTS } from "@/lib/blog-starters";

const PUBLIC = { id: true, slug: true, title: true, excerpt: true, tags: true, publishedAt: true, updatedAt: true } as const;

// ───────── public ─────────

export async function listPublished(opts: { page?: number; pageSize?: number; tag?: string } = {}) {
  const pageSize = opts.pageSize ?? 10;
  const page = Math.max(1, opts.page ?? 1);
  const where = { status: "PUBLISHED" as const, ...(opts.tag ? { tags: { has: opts.tag } } : {}) };
  const [total, items] = await Promise.all([
    db.blogPost.count({ where }),
    db.blogPost.findMany({
      where,
      select: PUBLIC,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, items, page, pageSize };
}

export async function getPublished(slug: string) {
  return db.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { ...PUBLIC, body: true, author: { select: { name: true } } },
  });
}

export async function publishedForSitemap() {
  return db.blogPost.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
    take: 5000,
  });
}

// ───────── admin ─────────

export async function adminList(actor: AdminActor) {
  assertAdmin(actor);
  return db.blogPost.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, slug: true, title: true, status: true, publishedAt: true, updatedAt: true },
  });
}

export async function adminGet(actor: AdminActor, id: string) {
  assertAdmin(actor);
  return db.blogPost.findUnique({ where: { id } });
}

/** Creates (id = null) or updates a post. Publication state is changed separately. */
export async function savePost(actor: AdminActor, id: string | null, raw: unknown) {
  assertAdmin(actor);
  const p = postSchema.safeParse(raw);
  if (!p.success)
    throw new AppError("Please fix the highlighted fields.", "VALIDATION", fieldErrorsFrom(p.error));
  const d = p.data;
  const slug = slugify(d.slug || d.title);
  if (!slug)
    throw new AppError("Please fix the highlighted fields.", "VALIDATION", { slug: "Use letters or numbers" });
  const clash = await db.blogPost.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== id)
    throw new AppError("Please fix the highlighted fields.", "VALIDATION", {
      slug: "Another article already uses this address",
    });
  const data = {
    slug,
    title: d.title,
    excerpt: d.excerpt,
    body: d.body.replace(/\r\n?/g, "\n"),
    tags: parseTags(d.tags),
  };
  const post = id
    ? await db.blogPost.update({ where: { id }, data })
    : await db.blogPost.create({ data: { ...data, authorId: actor.userId } });
  await audit({
    actorId: actor.userId,
    action: id ? "blog.updated" : "blog.created",
    entity: "BlogPost",
    entityId: post.id,
  });
  return post;
}

/** The first publication date is kept when a post is unpublished and published again. */
export async function setPublished(actor: AdminActor, id: string, publish: boolean) {
  assertAdmin(actor);
  const post = await db.blogPost.findUnique({ where: { id }, select: { id: true, publishedAt: true } });
  if (!post) throw new AppError("Article not found.", "NOT_FOUND");
  await db.blogPost.update({
    where: { id },
    data: publish
      ? { status: "PUBLISHED", publishedAt: post.publishedAt ?? new Date() }
      : { status: "DRAFT" },
  });
  await audit({
    actorId: actor.userId,
    action: publish ? "blog.published" : "blog.unpublished",
    entity: "BlogPost",
    entityId: id,
  });
}

/** Adds the starter articles as drafts. Existing slugs are left untouched, so it is safe to repeat. */
export async function importStarters(actor: AdminActor) {
  assertAdmin(actor);
  const existing = new Set(
    (await db.blogPost.findMany({ where: { slug: { in: STARTER_POSTS.map((s) => s.slug) } }, select: { slug: true } })).map(
      (r) => r.slug,
    ),
  );
  const fresh = STARTER_POSTS.filter((s) => !existing.has(s.slug));
  if (fresh.length)
    await db.blogPost.createMany({
      data: fresh.map((s) => ({ ...s, authorId: actor.userId, status: "DRAFT" as const })),
      skipDuplicates: true,
    });
  await audit({ actorId: actor.userId, action: "blog.starters_imported", meta: { added: fresh.length } });
  return fresh.length;
}
