"use client";
import { useActionState } from "react";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton, fe } from "@/components/forms/shared";
import { savePostAction, type ActionState } from "@/server/actions";

type Post = { id: string; slug: string; title: string; excerpt: string; body: string; tags: string[] };

export function BlogForm({ post }: { post?: Post }) {
  const [state, action] = useActionState<ActionState, FormData>(savePostAction, {});
  return (
    <form action={action} className="space-y-4">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      <Card className="space-y-4">
        <Field label="Title" error={fe(state, "title")}>
          <Input name="title" defaultValue={post?.title ?? ""} required maxLength={160} />
        </Field>
        <Field label="Web address" hint="Leave blank to build it from the title. Letters, numbers and hyphens." error={fe(state, "slug")}>
          <Input name="slug" defaultValue={post?.slug ?? ""} maxLength={80} placeholder="how-to-compare-quotes" />
        </Field>
        <Field label="Summary" hint="Shown in lists and search results (20–300 characters)." error={fe(state, "excerpt")}>
          <Textarea name="excerpt" rows={2} defaultValue={post?.excerpt ?? ""} required maxLength={300} />
        </Field>
        <Field label="Tags" hint="Comma-separated, up to 5" error={fe(state, "tags")}>
          <Input name="tags" defaultValue={post?.tags.join(", ") ?? ""} />
        </Field>
      </Card>
      <Card className="space-y-2">
        <Field
          label="Article"
          hint="Markdown: # headings, **bold**, *italic*, - lists, 1. numbered lists, > quotes, [text](https://…). HTML is not interpreted."
          error={fe(state, "body")}
        >
          <Textarea name="body" rows={22} defaultValue={post?.body ?? ""} required className="font-mono text-sm" />
        </Field>
      </Card>
      <FormMessage state={state} />
      <SubmitButton>{post ? "Save changes" : "Create draft"}</SubmitButton>
    </form>
  );
}
