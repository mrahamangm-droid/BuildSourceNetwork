import { z } from "zod";
import { db } from "@bmn/database";
import { assertBuyer, assertCan, type Ctx } from "../ctx";
import { AppError } from "../errors";
import { hit } from "../rate-limit";
import { audit } from "./notify";
import { getEffectiveLimits } from "./plans";
import { appendItems, own } from "./projects";
import {
  AI_MAX_DESCRIPTION,
  AI_MAX_LINES,
  AI_MIN_DESCRIPTION,
  AI_SYSTEM_PROMPT,
  aiMonthlyCap,
  buildUserPrompt,
  parseAiLines,
  type AiLine,
} from "@/lib/ai-boq";

const ACTION = "boq.ai_suggested";
const WINDOW_MS = 30 * 864e5;
const API_URL = "https://api.anthropic.com/v1/messages";
/** Override with ANTHROPIC_MODEL if your account uses a different model id. */
const DEFAULT_MODEL = "claude-sonnet-4-5";

function guard(ctx: Ctx) {
  assertBuyer(ctx);
  assertCan(ctx, "project.manage");
}

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

async function usage(ctx: Ctx) {
  const [lim, used] = await Promise.all([
    getEffectiveLimits(ctx.orgId),
    db.auditLog.count({
      where: {
        orgId: ctx.orgId,
        action: ACTION,
        createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
      },
    }),
  ]);
  const cap = aiMonthlyCap(lim.planCode);
  return { planName: lim.planName, cap, used, remaining: Math.max(0, cap - used) };
}

/** Numbers for the UI: whether AI drafting is available and how many drafts are left. */
export async function aiStatus(ctx: Ctx) {
  guard(ctx);
  return { configured: aiConfigured(), ...(await usage(ctx)) };
}

const suggestSchema = z.object({
  description: z
    .string()
    .trim()
    .min(AI_MIN_DESCRIPTION, `Describe the project in at least ${AI_MIN_DESCRIPTION} characters`)
    .max(AI_MAX_DESCRIPTION, `Keep it under ${AI_MAX_DESCRIPTION} characters`),
});

async function callModel(userPrompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY!.trim();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45_000);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
        max_tokens: 4000,
        temperature: 0.2,
        system: AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) {
      // Never surface provider bodies to users; they can contain request details.
      console.error("[ai-boq] provider error", res.status);
      throw new AppError(
        res.status === 429
          ? "The AI service is busy. Please try again in a minute."
          : "The AI service could not draft this bill right now. Please try again.",
        "VALIDATION",
      );
    }
    const body = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (body.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n");
  } catch (e) {
    if (e instanceof AppError) throw e;
    console.error("[ai-boq] request failed", e instanceof Error ? e.name : e);
    throw new AppError("The AI service did not respond in time. Please try again.", "VALIDATION");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Drafts BOQ lines from a description. Nothing is saved: the caller shows the lines for review
 * and only `addAiLines` writes them. A draft is counted against the plan cap when the model is
 * called, whether or not the lines are later accepted.
 */
export async function suggestBoq(ctx: Ctx, projectId: string, raw: unknown) {
  guard(ctx);
  if (!aiConfigured())
    throw new AppError("AI drafting is not enabled on this platform yet.", "VALIDATION");
  const p = await own(ctx, projectId);
  const parsed = suggestSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError("Please describe the project.", "VALIDATION", {
      description: parsed.error.issues[0]?.message ?? "Describe the project",
    });
  const rl = hit(`ai-boq:${ctx.userId}`, 5, 60_000);
  if (!rl.ok)
    throw new AppError(`Slow down: try again in ${rl.retryAfterSec} seconds.`, "RATE_LIMIT");
  const u = await usage(ctx);
  if (u.remaining <= 0)
    throw new AppError(
      `Your ${u.planName} plan includes ${u.cap} AI drafts per 30 days and they are used up. Upgrade or try again later.`,
      "FORBIDDEN",
    );
  const reply = await callModel(
    buildUserPrompt({ kind: p.kind, city: p.city ?? null, description: parsed.data.description }),
  );
  const lines = parseAiLines(reply);
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: ACTION,
    entity: "Project",
    entityId: projectId,
    meta: { chars: parsed.data.description.length, lines: lines.length },
  });
  if (!lines.length)
    throw new AppError(
      "The AI could not turn that into a bill. Add more detail (area, floors, structure, finishes) and try again.",
      "VALIDATION",
      { description: "Not enough detail to draft a bill." },
    );
  return { lines, remaining: u.remaining - 1 };
}

const acceptSchema = z.object({
  lines: z
    .array(
      z.object({
        section: z.string().trim().min(1).max(60),
        description: z.string().trim().min(2).max(200),
        unit: z.string().trim().min(1).max(16),
        quantity: z.coerce.number().finite().gt(0).max(1e9),
        wastePercent: z.coerce.number().finite().min(0).max(100),
      }),
    )
    .min(1, "Select at least one line")
    .max(AI_MAX_LINES),
});

/** Saves lines the user reviewed. Re-validated on the server; the client is never trusted. */
export async function addAiLines(ctx: Ctx, projectId: string, raw: unknown) {
  guard(ctx);
  await own(ctx, projectId);
  const parsed = acceptSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(parsed.error.issues[0]?.message ?? "Select at least one line", "VALIDATION");
  const lines: AiLine[] = parsed.data.lines;
  await appendItems(
    ctx,
    projectId,
    lines.map((l) => ({ ...l, unitRate: null })),
  );
  await audit({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: "boq.ai_lines_added",
    entity: "Project",
    entityId: projectId,
    meta: { lines: lines.length },
  });
  return lines.length;
}
