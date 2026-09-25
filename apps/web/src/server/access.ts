import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@bmn/database";
import { auth } from "./auth";
import { buildCtx, type Ctx } from "./ctx";

export * from "./ctx";

export const getSessionUserId = cache(async (): Promise<string | null> => {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
});

export const getCtx = cache(async (): Promise<Ctx | null> => {
  const id = await getSessionUserId();
  return id ? buildCtx(id) : null;
});

/** For pages/layouts: redirects instead of throwing. */
export async function requireCtx(): Promise<Ctx> {
  const id = await getSessionUserId();
  if (!id) redirect("/login");
  const ctx = await buildCtx(id);
  if (!ctx) redirect("/login");
  return ctx;
}

/**
 * Platform-admin gate. Admins may have no organization membership, so this deliberately does
 * not go through buildCtx().
 */
export const getAdminUser = cache(async () => {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, isPlatformAdmin: true },
  });
  return user?.isPlatformAdmin ? user : null;
});

export async function requireAdmin() {
  const id = await getSessionUserId();
  if (!id) redirect("/login?next=/admin");
  const admin = await getAdminUser();
  if (!admin) redirect("/dashboard");
  return admin;
}
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@bmn/database";
import { auth } from "./auth";
import { buildCtx, type Ctx } from "./ctx";

export * from "./ctx";

export const getSessionUserId = cache(async (): Promise<string | null> => {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
});

export const getCtx = cache(async (): Promise<Ctx | null> => {
  const id = await getSessionUserId();
  return id ? buildCtx(id) : null;
});

/** For pages/layouts: redirects instead of throwing. */
export async function requireCtx(): Promise<Ctx> {
  const id = await getSessionUserId();
  if (!id) redirect("/login");
  const ctx = await buildCtx(id);
  if (!ctx) redirect("/login");
  return ctx;
}

/**
 * Platform-admin gate. Admins may have no organization membership, so this deliberately does
 * not go through buildCtx().
 */
export const getAdminUser = cache(async () => {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, isPlatformAdmin: true },
  });
  return user?.isPlatformAdmin ? user : null;
});

export async function requireAdmin() {
  const id = await getSessionUserId();
  if (!id) redirect("/login?next=/admin");
  const admin = await getAdminUser();
  if (!admin) redirect("/dashboard");
  return admin;
}
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@bmn/database";
import { auth } from "./auth";
import { buildCtx, type Ctx } from "./ctx";

export * from "./ctx";

export const getSessionUserId = cache(async (): Promise<string | null> => {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
});

export const getCtx = cache(async (): Promise<Ctx | null> => {
  const id = await getSessionUserId();
  return id ? buildCtx(id) : null;
});

/** For pages/layouts: redirects instead of throwing. */
export async function requireCtx(): Promise<Ctx> {
  const id = await getSessionUserId();
  if (!id) redirect("/login");
  const ctx = await buildCtx(id);
  if (!ctx) redirect("/login");
  return ctx;
}

/**
 * Platform-admin gate. Admins may have no organization membership, so this deliberately does
 * not go through buildCtx().
 */
export const getAdminUser = cache(async () => {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, isPlatformAdmin: true },
  });
  return user?.isPlatformAdmin ? user : null;
});

export async function requireAdmin() {
  const id = await getSessionUserId();
  if (!id) redirect("/login?next=/admin");
  const admin = await getAdminUser();
  if (!admin) redirect("/dashboard");
  return admin;
}
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@bmn/database";
import { auth } from "./auth";
import { buildCtx, type Ctx } from "./ctx";

export * from "./ctx";

export const getSessionUserId = cache(async (): Promise<string | null> => {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
});

export const getCtx = cache(async (): Promise<Ctx | null> => {
  const id = await getSessionUserId();
  return id ? buildCtx(id) : null;
});

/** For pages/layouts: redirects instead of throwing. */
export async function requireCtx(): Promise<Ctx> {
  const id = await getSessionUserId();
  if (!id) redirect("/login");
  const ctx = await buildCtx(id);
  if (!ctx) redirect("/login");
  return ctx;
}

/**
 * Platform-admin gate. Admins may have no organization membership, so this deliberately does
 * not go through buildCtx().
 */
export const getAdminUser = cache(async () => {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, isPlatformAdmin: true },
  });
  return user?.isPlatformAdmin ? user : null;
});

export async function requireAdmin() {
  const id = await getSessionUserId();
  if (!id) redirect("/login?next=/admin");
  const admin = await getAdminUser();
  if (!admin) redirect("/dashboard");
  return admin;
}
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { buildCtx, type Ctx } from "./ctx";

export * from "./ctx";

export const getSessionUserId = cache(async (): Promise<string | null> => {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
});

export const getCtx = cache(async (): Promise<Ctx | null> => {
  const id = await getSessionUserId();
  return id ? buildCtx(id) : null;
});

/** For pages/layouts: redirects instead of throwing. */
export async function requireCtx(): Promise<Ctx> {
  const id = await getSessionUserId();
  if (!id) redirect("/login");
  const ctx = await buildCtx(id);
  if (!ctx) redirect("/login");
  return ctx;
}
