"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { db } from "@bmn/database";
import { signIn, signOut } from "./auth";
import { getCtx, requireCtx, requireAdmin } from "./access";
import { AppError } from "./errors";
import * as accounts from "./services/accounts";
import * as orgs from "./services/orgs";
import * as products from "./services/products";
import * as rfq from "./services/rfq";
import * as orders from "./services/orders";
import * as admin from "./services/admin";
import * as inventory from "./services/inventory";
import * as delivery from "./services/delivery";
import * as customers from "./services/customers";
import * as pricing from "./services/pricing";
import * as projects from "./services/projects";
import * as aiBoq from "./services/ai-boq";
import * as orderStock from "./services/order-stock";
import * as plans from "./services/plans";
import * as branches from "./services/branches";
import * as blog from "./services/blog";
import * as rfqAttachments from "./services/rfq-attachments";
import type { DeliveryStatusValue } from "@/lib/delivery-rules";
import { ORDER_STATUSES, type OrderStatus } from "@bmn/config";

export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  devLink?: string;
};

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Only allow same-site relative redirects. */
export async function safeNext(next: unknown, fallback = "/dashboard") {
  return typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("\\")
    ? next
    : fallback;
}

function fail(e: unknown): ActionState {
  if (e instanceof AppError) return { error: e.message, fieldErrors: e.fieldErrors };
  const code = (e as { code?: string })?.code;
  if (code === "P2034")
    return { error: "That was changed by someone else at the same time. Please try again." };
  console.error("[action] unexpected error", e);
  return { error: "Something went wrong. Please try again." };
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

// ───────── auth ─────────

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await accounts.registerAccount(
      {
        name: str(fd, "name"),
        email: str(fd, "email"),
        password: str(fd, "password"),
        orgType: str(fd, "orgType"),
        orgName: str(fd, "orgName"),
        city: str(fd, "city"),
      },
      await ip(),
    );
  } catch (e) {
    return fail(e);
  }
  try {
    await signIn("credentials", {
      email: str(fd, "email").toLowerCase(),
      password: str(fd, "password"),
      redirectTo: "/dashboard?welcome=1",
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Account created. Please sign in." };
    throw e; // NEXT_REDIRECT
  }
  return { ok: true };
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: str(fd, "email"),
      password: str(fd, "password"),
      redirectTo: await safeNext(str(fd, "next")),
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Invalid email or password." };
    throw e;
  }
  return { ok: true };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const res = await accounts.requestPasswordReset(str(fd, "email"), await ip());
    return {
      ok: true,
      message: "If that email is registered, a reset link is on its way.",
      devLink: res.token ? `/reset-password?token=${res.token}` : undefined,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await accounts.resetPassword(str(fd, "token"), str(fd, "password"));
  } catch (e) {
    return fail(e);
  }
  redirect("/login?reset=1");
}

export async function resendVerificationAction(): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await accounts.resendVerification(ctx.userId);
    return { ok: true, message: "Verification email sent." };
  } catch (e) {
    return fail(e);
  }
}

// ───────── organization ─────────

export async function saveOrgProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await orgs.updateOrgProfile(ctx, {
      name: str(fd, "name"),
      description: str(fd, "description"),
      phone: str(fd, "phone"),
      email: str(fd, "email"),
      website: str(fd, "website"),
      addressLine: str(fd, "addressLine"),
      city: str(fd, "city"),
      businessHours: str(fd, "businessHours"),
      deliveryAreas: str(fd, "deliveryAreas"),
      categoryIds: fd.getAll("categoryIds").map(String),
      logoUrl: str(fd, "logoUrl"),
      coverUrl: str(fd, "coverUrl"),
      supplierKind: str(fd, "supplierKind"),
      leadTimeDays: str(fd, "leadTimeDays"),
      minOrderNote: str(fd, "minOrderNote"),
      capacityNote: str(fd, "capacityNote"),
      certifications: str(fd, "certifications"),
    });
    revalidatePath("/dashboard/profile");
    return { ok: true, message: "Profile saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveUserSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    const name = str(fd, "name").trim();
    if (name.length < 2)
      return { error: "Enter your name", fieldErrors: { name: "Enter your name" } };
    await db.user.update({
      where: { id: ctx.userId },
      data: {
        name,
        phone: str(fd, "phone").trim() || null,
        notifyEmail: fd.get("notifyEmail") === "on",
        notifyInApp: fd.get("notifyInApp") === "on",
      },
    });
    revalidatePath("/dashboard/settings");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return fail(e);
  }
}

// ───────── products ─────────

function productPayload(fd: FormData) {
  return {
    name: str(fd, "name"),
    sku: str(fd, "sku"),
    categoryId: str(fd, "categoryId"),
    brandName: str(fd, "brandName"),
    unitCode: str(fd, "unitCode"),
    description: str(fd, "description"),
    packageSize: str(fd, "packageSize"),
    minOrderQty: str(fd, "minOrderQty") || 1,
    stockStatus: str(fd, "stockStatus") || "IN_STOCK",
    price: str(fd, "price"),
    wholesalePrice: str(fd, "wholesalePrice"),
    contractorPrice: str(fd, "contractorPrice"),
    vatRatePercent: str(fd, "vatRatePercent") || 5,
    city: str(fd, "city"),
    deliveryAvailable: fd.get("deliveryAvailable") === "on",
    isActive: fd.get("isActive") === "on",
    specifications: str(fd, "specifications"),
    imageUrl: str(fd, "imageUrl"),
  };
}

export async function saveProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  try {
    const ctx = await requireCtx();
    if (id) await products.updateProduct(ctx, id, productPayload(fd));
    else await products.createProduct(ctx, productPayload(fd));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/dashboard/products");
  redirect("/dashboard/products?saved=1");
}

export async function archiveProductAction(fd: FormData) {
  const ctx = await requireCtx();
  await products.archiveProduct(ctx, str(fd, "id"));
  revalidatePath("/dashboard/products");
}

// ───────── RFQ & quotes ─────────

export async function createRfqAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const ctx = await requireCtx();
    let items: unknown = [];
    try {
      items = JSON.parse(str(fd, "items") || "[]");
    } catch {
      /* validation reports it */
    }
    const res = await rfq.createRfq(ctx, {
      title: str(fd, "title"),
      mode: str(fd, "mode") || "get3",
      deliveryCity: str(fd, "deliveryCity"),
      deliveryAddress: str(fd, "deliveryAddress"),
      requiredDate: str(fd, "requiredDate"),
      notes: str(fd, "notes"),
      items,
      supplierOrgIds: fd.getAll("supplierOrgIds").map(String).filter(Boolean),
    });
    id = res.rfq.id;
  } catch (e) {
    return fail(e);
  }
  redirect(`/dashboard/rfqs/${id}?sent=1`);
}

export async function submitQuoteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const rfqId = str(fd, "rfqId");
  try {
    const ctx = await requireCtx();
    const ids = fd.getAll("itemId").map(String);
    await rfq.submitQuote(ctx, rfqId, {
      deliveryDays: str(fd, "deliveryDays") || undefined,
      deliveryCost: str(fd, "deliveryCost") || 0,
      validDays: str(fd, "validDays") || 7,
      notes: str(fd, "notes"),
      items: ids.map((id) => ({
        rfqItemId: id,
        unitPrice: str(fd, `price_${id}`),
        quantityAvailable: str(fd, `qty_${id}`),
        minOrderQty: str(fd, `moq_${id}`) || 1,
      })),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/dashboard/rfqs/${rfqId}`);
  return { ok: true, message: "Quote sent to the buyer." };
}

export async function declineRfqAction(fd: FormData) {
  const ctx = await requireCtx();
  await rfq.declineRfq(ctx, str(fd, "rfqId"));
  revalidatePath("/dashboard/rfqs");
  redirect("/dashboard/rfqs");
}

export async function cancelRfqAction(fd: FormData) {
  const ctx = await requireCtx();
  await rfq.cancelRfq(ctx, str(fd, "rfqId"));
  revalidatePath(`/dashboard/rfqs/${str(fd, "rfqId")}`);
}

export async function removeRfqAttachmentAction(fd: FormData) {
  const rfqId = str(fd, "rfqId");
  try {
    const ctx = await requireCtx();
    await rfqAttachments.removeAttachment(ctx, str(fd, "id"));
  } catch (e) {
    redirect(
      `/dashboard/rfqs/${rfqId}?error=${encodeURIComponent(fail(e).error ?? "Could not remove file")}`,
    );
  }
  revalidatePath(`/dashboard/rfqs/${rfqId}`);
}

export async function acceptQuoteAction(fd: FormData) {
  let orderId: string;
  try {
    const ctx = await requireCtx();
    orderId = (await rfq.acceptQuote(ctx, str(fd, "quoteId"))).id;
  } catch (e) {
    const rfqId = str(fd, "rfqId");
    redirect(
      `/dashboard/rfqs/${rfqId}?error=${encodeURIComponent(fail(e).error ?? "Could not accept quote")}`,
    );
  }
  redirect(`/dashboard/orders/${orderId}?created=1`);
}

// ───────── orders ─────────

export async function advanceOrderAction(fd: FormData) {
  const orderId = str(fd, "orderId");
  const next = str(fd, "next") as OrderStatus;
  if (!(ORDER_STATUSES as readonly string[]).includes(next))
    redirect(`/dashboard/orders/${orderId}`);
  try {
    const ctx = await requireCtx();
    await orders.advanceOrder(ctx, orderId, next, str(fd, "note"));
  } catch (e) {
    redirect(
      `/dashboard/orders/${orderId}?error=${encodeURIComponent(fail(e).error ?? "Update failed")}`,
    );
  }
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(`/dashboard/orders/${orderId}`);
}

export async function submitReviewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await orders.submitReview(ctx, str(fd, "orderId"), {
      rating: str(fd, "rating"),
      comment: str(fd, "comment"),
    });
    revalidatePath(`/dashboard/orders/${str(fd, "orderId")}`);
    return { ok: true, message: "Thanks for your review." };
  } catch (e) {
    return fail(e);
  }
}

// ───────── notifications ─────────

export async function markNotificationsReadAction() {
  const ctx = await getCtx();
  if (!ctx) return;
  await db.notification.updateMany({
    where: { userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/dashboard/notifications");
}

// ───────── verification (company side) ─────────

export async function submitVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await admin.submitVerification(ctx, {
      legalName: str(fd, "legalName"),
      licenseNumber: str(fd, "licenseNumber"),
      licenseAuthority: str(fd, "licenseAuthority"),
      taxNumber: str(fd, "taxNumber"),
      licenseDocUrl: str(fd, "licenseDocUrl"),
      notes: str(fd, "notes"),
    });
    revalidatePath("/dashboard/verification");
    return { ok: true, message: "Submitted. We will review your documents and notify you." };
  } catch (e) {
    return fail(e);
  }
}

// ───────── platform admin ─────────

export async function reviewVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const a = await requireAdmin();
    const decision = str(fd, "decision") === "APPROVE" ? "APPROVE" : "REJECT";
    await admin.reviewVerification(
      { userId: a.id, isPlatformAdmin: true },
      str(fd, "requestId"),
      decision,
      str(fd, "note"),
    );
    revalidatePath("/admin/verification");
    return { ok: true, message: decision === "APPROVE" ? "Approved." : "Rejected." };
  } catch (e) {
    return fail(e);
  }
}

export async function setOrgActiveAction(fd: FormData) {
  const a = await requireAdmin();
  await admin.setOrgActive(
    { userId: a.id, isPlatformAdmin: true },
    str(fd, "orgId"),
    str(fd, "active") === "1",
  );
  revalidatePath("/admin/organizations");
}

export async function revokeVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const a = await requireAdmin();
    await admin.revokeVerification(
      { userId: a.id, isPlatformAdmin: true },
      str(fd, "orgId"),
      str(fd, "note"),
    );
    revalidatePath("/admin/organizations");
    return { ok: true, message: "Verification revoked." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const a = await requireAdmin();
    await admin.updateSettings(
      { userId: a.id, isPlatformAdmin: true },
      Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])),
    );
    revalidatePath("/admin/settings");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return fail(e);
  }
}

// ───────── inventory ─────────

const MOVES = ["RECEIPT", "ISSUE", "ADJUSTMENT", "RESERVE", "RELEASE"] as const;

export async function stockMovementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const kind = str(fd, "kind");
  if (!(MOVES as readonly string[]).includes(kind))
    return { error: "Choose what happened to the stock." };
  try {
    const ctx = await requireCtx();
    const r = await inventory.move(ctx, kind as (typeof MOVES)[number], {
      productId: str(fd, "productId"),
      warehouseId: str(fd, "warehouseId"),
      quantity: str(fd, "quantity"),
      unitCost: str(fd, "unitCost"),
      reference: str(fd, "reference"),
      note: str(fd, "note"),
    });
    revalidatePath("/dashboard/inventory");
    return { ok: true, message: `${r.productName}: ${r.onHand} on hand.` };
  } catch (e) {
    return fail(e);
  }
}

// ───────── blog (platform admin) ─────────

export async function savePostAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id") || null;
  let createdId: string | null = null;
  try {
    const a = await requireAdmin();
    const post = await blog.savePost({ userId: a.id, isPlatformAdmin: true }, id, {
      title: str(fd, "title"),
      slug: str(fd, "slug"),
      excerpt: str(fd, "excerpt"),
      body: fd.get("body")?.toString() ?? "",
      tags: str(fd, "tags"),
    });
    if (!id) createdId = post.id;
    revalidatePath("/admin/blog");
    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);
  } catch (e) {
    return fail(e);
  }
  if (createdId) redirect(`/admin/blog/${createdId}?saved=1`);
  return { ok: true, message: "Saved." };
}

export async function setPostPublishedAction(fd: FormData) {
  const id = str(fd, "id");
  const a = await requireAdmin();
  await blog.setPublished({ userId: a.id, isPlatformAdmin: true }, id, str(fd, "publish") === "1");
  revalidatePath("/admin/blog");
  revalidatePath(`/admin/blog/${id}`);
  revalidatePath("/blog");
}

export async function importStarterPostsAction() {
  const a = await requireAdmin();
  await blog.importStarters({ userId: a.id, isPlatformAdmin: true });
  revalidatePath("/admin/blog");
}

// ───────── branches & warehouses ─────────

export async function createBranchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await branches.createBranch(ctx, {
      name: str(fd, "name"),
      city: str(fd, "city"),
      address: str(fd, "address"),
    });
    revalidatePath("/dashboard/branches");
    return { ok: true, message: "Branch added." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateBranchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await branches.updateBranch(ctx, str(fd, "id"), {
      name: str(fd, "name"),
      city: str(fd, "city"),
      address: str(fd, "address"),
    });
    revalidatePath("/dashboard/branches");
    return { ok: true, message: "Branch saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function addWarehouseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await branches.addWarehouse(ctx, str(fd, "branchId"), { name: str(fd, "name") });
    revalidatePath("/dashboard/branches");
    return { ok: true, message: "Warehouse added." };
  } catch (e) {
    return fail(e);
  }
}

async function branchesRedirect(work: () => Promise<void>): Promise<never> {
  let error: string | null = null;
  try {
    await work();
  } catch (e) {
    error = fail(e).error ?? "Something went wrong";
  }
  revalidatePath("/dashboard/branches");
  redirect(
    error ? `/dashboard/branches?error=${encodeURIComponent(error)}` : "/dashboard/branches",
  );
}

export async function deleteBranchAction(fd: FormData) {
  return branchesRedirect(async () => branches.deleteBranch(await requireCtx(), str(fd, "id")));
}

export async function deleteWarehouseAction(fd: FormData) {
  return branchesRedirect(async () => branches.deleteWarehouse(await requireCtx(), str(fd, "id")));
}

export async function transferStockAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await branches.transferStock(ctx, {
      productId: str(fd, "productId"),
      fromWarehouseId: str(fd, "fromWarehouseId"),
      toWarehouseId: str(fd, "toWarehouseId"),
      quantity: str(fd, "quantity"),
      note: str(fd, "note"),
    });
    revalidatePath("/dashboard/branches");
    revalidatePath("/dashboard/inventory");
    return { ok: true, message: "Stock transferred." };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderLevelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await inventory.setReorderLevel(
      ctx,
      str(fd, "productId"),
      undefined,
      Number(str(fd, "reorderLevel")),
    );
    revalidatePath("/dashboard/inventory");
    return { ok: true, message: "Reorder level saved." };
  } catch (e) {
    return fail(e);
  }
}

// ───────── delivery ─────────

const deliveryPayload = (fd: FormData) => ({
  scheduledAt: str(fd, "scheduledAt"),
  driverName: str(fd, "driverName"),
  driverPhone: str(fd, "driverPhone"),
  vehicle: str(fd, "vehicle"),
  address: str(fd, "address"),
  notes: str(fd, "notes"),
});

export async function saveDeliveryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const orderId = str(fd, "orderId");
  const id = str(fd, "deliveryId");
  try {
    const ctx = await requireCtx();
    if (id) await delivery.updateDelivery(ctx, id, deliveryPayload(fd));
    else await delivery.scheduleDelivery(ctx, orderId, deliveryPayload(fd));
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/deliveries");
  return { ok: true, message: id ? "Delivery updated." : "Delivery scheduled." };
}

const DELIVERY_TARGETS = ["ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED"];

export async function advanceDeliveryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const target = str(fd, "target");
  if (!DELIVERY_TARGETS.includes(target)) return { error: "Unknown delivery step." };
  try {
    const ctx = await requireCtx();
    await delivery.advanceDelivery(ctx, str(fd, "deliveryId"), target as DeliveryStatusValue, {
      recipientName: str(fd, "recipientName"),
      proofUrl: str(fd, "proofUrl"),
      proofNote: str(fd, "proofNote"),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/dashboard/orders/${str(fd, "orderId")}`);
  revalidatePath("/dashboard/deliveries");
  return { ok: true, message: "Delivery updated." };
}

// ───────── customers & credit ─────────

const customerPayload = (fd: FormData) => ({
  name: str(fd, "name"),
  contactName: str(fd, "contactName"),
  phone: str(fd, "phone"),
  email: str(fd, "email"),
  city: str(fd, "city"),
  address: str(fd, "address"),
  taxNumber: str(fd, "taxNumber"),
  creditLimit: str(fd, "creditLimit"),
  paymentTermsDays: str(fd, "paymentTermsDays") || 30,
  notes: str(fd, "notes"),
});

export async function saveCustomerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  let target = id;
  try {
    const ctx = await requireCtx();
    if (id) await customers.updateCustomer(ctx, id, customerPayload(fd));
    else target = (await customers.createCustomer(ctx, customerPayload(fd))).id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/dashboard/customers");
  redirect(`/dashboard/customers/${target}`);
}

export async function createInvoiceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const customerId = str(fd, "customerId");
  try {
    const ctx = await requireCtx();
    const inv = await customers.createInvoice(ctx, customerId, {
      description: str(fd, "description"),
      reference: str(fd, "reference"),
      subtotal: str(fd, "subtotal"),
      vatPercent: str(fd, "vatPercent") || 5,
      issuedAt: str(fd, "issuedAt"),
      termsDays: str(fd, "termsDays"),
      notes: str(fd, "notes"),
      overrideCredit: fd.get("overrideCredit") === "on",
    });
    revalidatePath(`/dashboard/customers/${customerId}`);
    return { ok: true, message: `Invoice ${inv.number} created.` };
  } catch (e) {
    return fail(e);
  }
}

export async function recordPaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const customerId = str(fd, "customerId");
  try {
    const ctx = await requireCtx();
    await customers.recordPayment(ctx, customerId, {
      amount: str(fd, "amount"),
      method: str(fd, "method"),
      invoiceId: str(fd, "invoiceId"),
      reference: str(fd, "reference"),
      note: str(fd, "note"),
      receivedAt: str(fd, "receivedAt"),
    });
    revalidatePath(`/dashboard/customers/${customerId}`);
    return { ok: true, message: "Payment recorded." };
  } catch (e) {
    return fail(e);
  }
}

export async function voidInvoiceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await customers.voidInvoice(ctx, str(fd, "invoiceId"), str(fd, "reason"));
    revalidatePath(`/dashboard/customers/${str(fd, "customerId")}`);
    return { ok: true, message: "Invoice voided." };
  } catch (e) {
    return fail(e);
  }
}

export async function voidPaymentAction(fd: FormData) {
  const ctx = await requireCtx();
  await customers.voidPayment(ctx, str(fd, "paymentId"));
  revalidatePath(`/dashboard/customers/${str(fd, "customerId")}`);
}

export async function savePriceBreaksAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const productId = str(fd, "productId");
  const rows = Array.from({ length: 6 }, (_, i) => ({
    minQty: str(fd, `minQty_${i}`),
    price: str(fd, `price_${i}`),
  }));
  try {
    const ctx = await requireCtx();
    const n = await pricing.saveBreaks(ctx, productId, rows);
    revalidatePath(`/dashboard/products/${productId}/pricing`);
    revalidatePath(`/products/${productId}`);
    return {
      ok: true,
      message: n ? `${n} price break${n === 1 ? "" : "s"} saved.` : "Price breaks cleared.",
    };
  } catch (e) {
    return fail(e);
  }
}

const projectPayload = (fd: FormData) => ({
  name: str(fd, "name"),
  kind: str(fd, "kind"),
  status: str(fd, "status") || "PLANNING",
  city: str(fd, "city"),
  startDate: str(fd, "startDate"),
  budget: str(fd, "budget"),
  notes: str(fd, "notes"),
});

export async function saveProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  let target = id;
  try {
    const ctx = await requireCtx();
    if (id) await projects.updateProject(ctx, id, projectPayload(fd));
    else target = (await projects.createProject(ctx, projectPayload(fd))).id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${target}`);
  if (!id) redirect(`/dashboard/projects/${target}`);
  return { ok: true, message: "Project saved." };
}

export async function addBoqItemAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const projectId = str(fd, "projectId");
  try {
    const ctx = await requireCtx();
    await projects.addItem(ctx, projectId, {
      section: str(fd, "section"),
      description: str(fd, "description"),
      unit: str(fd, "unit"),
      quantity: str(fd, "quantity"),
      wastePercent: str(fd, "wastePercent") || 0,
      unitRate: str(fd, "unitRate"),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true, message: "Line added." };
}

export async function updateBoqItemAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const projectId = str(fd, "projectId");
  try {
    const ctx = await requireCtx();
    await projects.updateItem(ctx, str(fd, "itemId"), {
      quantity: str(fd, "quantity"),
      wastePercent: str(fd, "wastePercent") || 0,
      unitRate: str(fd, "unitRate"),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true, message: "Saved." };
}

export async function deleteBoqItemAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const projectId = str(fd, "projectId");
  try {
    const ctx = await requireCtx();
    await projects.deleteItem(ctx, str(fd, "itemId"));
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}

export type AiBoqState = ActionState & {
  lines?: {
    section: string;
    description: string;
    unit: string;
    quantity: number;
    wastePercent: number;
  }[];
  remaining?: number;
};

/** Step 1: draft lines from a description. Saves nothing. */
export async function suggestAiBoqAction(_: AiBoqState, fd: FormData): Promise<AiBoqState> {
  const projectId = str(fd, "projectId");
  try {
    const ctx = await requireCtx();
    const r = await aiBoq.suggestBoq(ctx, projectId, { description: str(fd, "description") });
    return { ok: true, lines: r.lines, remaining: r.remaining };
  } catch (e) {
    return fail(e);
  }
}

/** Step 2: save the lines the user kept. The list is re-validated on the server. */
export async function addAiBoqLinesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const projectId = str(fd, "projectId");
  try {
    const ctx = await requireCtx();
    let lines: unknown;
    try {
      lines = JSON.parse(str(fd, "lines") || "[]");
    } catch {
      return { error: "Could not read the selected lines. Please draft again." };
    }
    const n = await aiBoq.addAiLines(ctx, projectId, { lines });
    revalidatePath(`/dashboard/projects/${projectId}`);
    return {
      ok: true,
      message: `${n} lines added. Check each quantity and enter your unit rates.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function starterBoqAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const projectId = str(fd, "projectId");
  try {
    const ctx = await requireCtx();
    const n = await projects.generateStarter(ctx, projectId, {
      areaM2: str(fd, "areaM2"),
      floors: str(fd, "floors") || 1,
    });
    revalidatePath(`/dashboard/projects/${projectId}`);
    return { ok: true, message: `${n} starter lines added. Enter your unit rates to price them.` };
  } catch (e) {
    return fail(e);
  }
}

export async function orderStockAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const orderId = str(fd, "orderId");
  const intent = str(fd, "intent");
  try {
    const ctx = await requireCtx();
    let n: number;
    if (intent === "reserve") {
      const mapping: Record<string, string> = {};
      for (const [k, v] of fd.entries())
        if (k.startsWith("product_") && typeof v === "string" && v) mapping[k.slice(8)] = v;
      n = await orderStock.reserveOrderStock(ctx, orderId, mapping, str(fd, "warehouseId"));
    } else if (intent === "issue") n = await orderStock.issueOrderStock(ctx, orderId);
    else if (intent === "release") n = await orderStock.releaseOrderStock(ctx, orderId);
    else return { error: "Unknown stock action." };
    revalidatePath(`/dashboard/orders/${orderId}`);
    revalidatePath("/dashboard/inventory");
    const verb = intent === "reserve" ? "reserved" : intent === "issue" ? "issued" : "released";
    return { ok: true, message: `${n} line${n === 1 ? "" : "s"} ${verb}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function requestPlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ctx = await requireCtx();
    await plans.requestPlan(ctx, { planCode: str(fd, "planCode"), note: str(fd, "note") });
    revalidatePath("/dashboard/billing");
    return {
      ok: true,
      message: "Request sent. We will confirm payment details and activate your plan.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function reviewPlanRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const a = await requireAdmin();
    const decision = str(fd, "decision") === "APPROVE" ? "APPROVE" : "REJECT";
    await plans.reviewPlanRequest(
      { userId: a.id, isPlatformAdmin: true },
      str(fd, "requestId"),
      decision,
      str(fd, "note"),
      str(fd, "paymentRef"),
    );
    revalidatePath("/admin/plans");
    return { ok: true, message: decision === "APPROVE" ? "Plan activated." : "Request rejected." };
  } catch (e) {
    return fail(e);
  }
}
