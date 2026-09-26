import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, LinkButton } from "@/components/ui";
import { Breadcrumbs, JsonLd } from "@/components/market/parts";
import { Markdown } from "@/components/market/markdown";
import { getPublished } from "@/server/services/blog";
import { readingMinutes } from "@/lib/markdown";
import { appUrl, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = await getPublished((await params).slug);
  if (!post) return { title: "Article not found", robots: { index: false } };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.excerpt },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPublished((await params).slug);
  if (!post) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.excerpt,
          datePublished: post.publishedAt?.toISOString(),
          dateModified: post.updatedAt.toISOString(),
          mainEntityOfPage: `${appUrl()}/blog/${post.slug}`,
          author: post.author ? { "@type": "Person", name: post.author.name } : undefined,
        }}
      />
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Blog", href: "/blog" }, { name: post.title }]} />
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{post.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {formatDate(post.publishedAt)} · {readingMinutes(post.body)} min read
      </p>
      {post.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {post.tags.map((t) => (
            <Link key={t} href={`/blog?tag=${t}`}>
              <Badge>{t}</Badge>
            </Link>
          ))}
        </div>
      ) : null}
      <div className="mt-6">
        <Markdown source={post.body} />
      </div>
      <div className="mt-10 rounded-xl border border-line bg-surface p-5">
        <p className="font-semibold">Ready to compare suppliers?</p>
        <p className="mt-1 text-sm text-muted">Send one request and receive quotes from matching suppliers.</p>
        <div className="mt-3">
          <LinkButton href="/request-quotes">Get 3 quotes</LinkButton>
        </div>
      </div>
    </article>
  );
}
