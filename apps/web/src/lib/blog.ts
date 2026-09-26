import { z } from "zod";
import { MAX_BODY_CHARS } from "@/lib/markdown";

export const postSchema = z.object({
  title: z.string().trim().min(5, "Enter a title (at least 5 characters)").max(160),
  slug: z.string().trim().max(80).optional().default(""),
  excerpt: z.string().trim().min(20, "Write a short summary (at least 20 characters)").max(300),
  body: z.string().min(50, "The article is too short").max(MAX_BODY_CHARS, "The article is too long"),
  tags: z.string().trim().max(200).optional().default(""),
});
