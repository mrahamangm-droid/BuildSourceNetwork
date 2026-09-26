import type { Metadata } from "next";
import { requireAdmin } from "@/server/access";
import { PageHeader } from "@/components/ui";
import { BlogForm } from "@/components/dashboard/blog-form";

export const metadata: Metadata = { title: "New article" };

export default async function NewPostPage() {
  await requireAdmin();
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="New article" />
      <BlogForm />
    </div>
  );
}
