import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@bmn/database";
import { ORG_TYPES, slugify } from "@bmn/config";
import { AppError } from "../errors";
import { issueToken, consumeToken } from "../tokens";
import { sendMail, verifyUrl, resetUrl } from "../email";
import { hit } from "../rate-limit";
import { audit } from "./notify";

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .refine((p) => /[a-z]/i.test(p) && /\d/.test(p), "Include letters and at least one number");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: passwordSchema,
  orgType: z.enum(ORG_TYPES),
  orgName: z.string().trim().min(2, "Enter your company name").max(120),
  city: z.string().trim().min(2, "Enter your city").max(80),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export function fieldErrorsFrom(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "company";
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    if (!(await db.organization.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function registerAccount(raw: unknown, ip = "unknown") {
  if (!hit(`register:${ip}`, 10, 60 * 60_000).ok)
    throw new AppError("Too many attempts. Try again later.", "RATE_LIMIT");
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success)
    throw new AppError(
      "Please fix the highlighted fields.",
      "VALIDATION",
      fieldErrorsFrom(parsed.error),
    );
  const d = parsed.data;
  if (await db.user.findUnique({ where: { email: d.email }, select: { id: true } }))
    throw new AppError("An account with this email already exists.", "CONFLICT", {
      email: "Email already registered",
    });

  const passwordHash = await bcrypt.hash(d.password, 12);
  const slug = await uniqueSlug(d.orgName);
  const user = await db.user.create({
    data: {
      email: d.email,
      name: d.name,
      passwordHash,
      memberships: {
        create: {
          role: "OWNER",
          org: {
            create: {
              type: d.orgType,
              name: d.orgName,
              slug,
              city: d.city,
              region: d.city,
              deliveryAreas: d.orgType === "SUPPLIER" ? [d.city] : [],
              subscription: { create: { planCode: "FREE" } },
            },
          },
        },
      },
    },
    include: { memberships: true },
  });
  const token = await issueToken(user.id, "EMAIL_VERIFY");
  await sendMail({
    to: user.email,
    subject: "Verify your email — Building Materials Network",
    text: `Welcome ${user.name}!\n\nConfirm your email: ${verifyUrl(token)}\n\nThe link expires in 48 hours.`,
  }).catch((e) =>
    console.error("[register] verification email failed", e instanceof Error ? e.message : e),
  );
  await audit({
    orgId: user.memberships[0].orgId,
    actorId: user.id,
    action: "account.registered",
    entity: "User",
    entityId: user.id,
  });
  return {
    userId: user.id,
    verifyToken: process.env.NODE_ENV === "production" ? undefined : token,
  };
}

export async function verifyEmail(token: string): Promise<boolean> {
  const userId = await consumeToken(token, "EMAIL_VERIFY");
  if (!userId) return false;
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return true;
}

export async function resendVerification(userId: string) {
  if (!hit(`resend:${userId}`, 3, 60 * 60_000).ok)
    throw new AppError("Too many requests. Try again later.", "RATE_LIMIT");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.emailVerifiedAt) return;
  const token = await issueToken(user.id, "EMAIL_VERIFY");
  await sendMail({
    to: user.email,
    subject: "Verify your email",
    text: `Confirm your email: ${verifyUrl(token)}`,
  });
}

/** Always resolves the same way so the endpoint cannot be used to discover registered emails. */
export async function requestPasswordReset(emailRaw: string, ip = "unknown") {
  if (!hit(`reset:${ip}`, 5, 60 * 60_000).ok)
    throw new AppError("Too many requests. Try again later.", "RATE_LIMIT");
  const email = emailRaw.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { token: undefined };
  const token = await issueToken(user.id, "PASSWORD_RESET");
  await sendMail({
    to: user.email,
    subject: "Reset your password",
    text: `Reset your password: ${resetUrl(token)}\n\nExpires in 1 hour. Ignore this email if you did not ask for it.`,
  });
  return { token: process.env.NODE_ENV === "production" ? undefined : token };
}

export async function resetPassword(token: string, newPassword: string) {
  const pw = passwordSchema.safeParse(newPassword);
  if (!pw.success)
    throw new AppError(pw.error.issues[0].message, "VALIDATION", {
      password: pw.error.issues[0].message,
    });
  const userId = await consumeToken(token, "PASSWORD_RESET");
  if (!userId) throw new AppError("This reset link is invalid or has expired.", "VALIDATION");
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });
  await audit({ actorId: userId, action: "account.password_reset" });
}
