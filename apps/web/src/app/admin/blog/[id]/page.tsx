import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/access";
import { setPostPublishedAction } from "@/server/actions";
import { adminGet } from "@/server/services/blog";
import { Alert, Badge, Button, PageHeader } from "@/components/ui";
import { BlogForm } from "@/components/dashboard/blog-form";

export const metadata: Metadata = { title: "Edit article" };

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const a = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const post = await adminGet({ userId: a.id, isPlatformAdmin: true }, id);
  if (!post) notFound();
  const published = post.status === "PUBLISHED";
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={post.title}
        action={
          <Badge tone={published ? "green" : "neutral"}>{published ? "Published" : "Draft"}</Badge>
        }
      />
      {sp.saved ? <Alert tone="success">Draft created.</Alert> : null}
      <div className="flex flex-wrap items-center gap-3">
        <form action={setPostPublishedAction}>
          <input type="hidden" name="id" value={post.id} />
          <input type="hidden" name="publish" value={published ? "0" : "1"} />
          <Button type="submit" variant={published ? "outline" : "primary"} size="sm">
            {published ? "Unpublish" : "Publish"}
          </Button>
        </form>
        {published ? (
          <Link className="text-sm text-brand-700 hover:underline" href={`/blog/${post.slug}`}>
            View article
          </Link>
        ) : null}
      </div>
      <BlogForm post={post} />
    </div>
  );
}
