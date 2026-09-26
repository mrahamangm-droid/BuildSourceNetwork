import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/access";
import { importStarterPostsAction } from "@/server/actions";
import { adminList } from "@/server/services/blog";
import { Badge, Button, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Blog" };

export default async function AdminBlogPage() {
  const a = await requireAdmin();
  const posts = await adminList({ userId: a.id, isPlatformAdmin: true });
  return (
    <div className="space-y-4">
      <PageHeader
        title="Blog"
        description="Articles are drafts until you publish them."
        action={<LinkButton href="/admin/blog/new">New article</LinkButton>}
      />
      {posts.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {posts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <Link href={`/admin/blog/${p.id}`} className="font-medium hover:text-brand-700">
                  {p.title}
                </Link>
                <p className="text-xs text-muted">
                  /blog/{p.slug} · updated {formatDate(p.updatedAt)}
                </p>
              </div>
              <Badge tone={p.status === "PUBLISHED" ? "green" : "neutral"}>
                {p.status === "PUBLISHED" ? "Published" : "Draft"}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No articles yet"
          body="Write your own, or add two starter guides as drafts to edit."
        />
      )}
      <form action={importStarterPostsAction}>
        <Button type="submit" variant="outline" size="sm">
          Add starter guides as drafts
        </Button>
      </form>
    </div>
  );
}
