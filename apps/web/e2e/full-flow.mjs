// End-to-end flow in a real browser against a running server (npm run build && npm start).
// Usage: BASE_URL=http://localhost:3000 SERVER_LOG=/path/to/server.log node e2e/full-flow.mjs
// Verification/reset links are read from the server log (EMAIL_PROVIDER unset => mails are logged).
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LOG = process.env.SERVER_LOG;
const SHOTS = process.env.SHOTS_DIR;
const run = Date.now().toString(36);
const PASSWORD = "E2eStrongPass99";
const step = (m) => console.log(`✔ ${m}`);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const newPage = async (opts = {}) =>
  (await browser.newContext({ baseURL: BASE, ...opts })).newPage();
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

function tokenFromLog(kind, email) {
  // mail body lines look like: "[mail:dev] to=<email> subject=..." followed by a URL containing ?token=
  const text = fs.readFileSync(LOG, "utf8");
  const blocks = text
    .split("[mail:dev]")
    .filter((b) => b.includes(`to=${email}`) && b.includes(kind));
  const last = blocks.at(-1);
  assert.ok(last, `no ${kind} mail logged for ${email}`);
  return last.match(/token=([a-f0-9]+)/)[1];
}

async function register(page, { type, company, city, name }) {
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${run}@e2e.example`;
  await page.goto(`/register?type=${type}`);
  await page.fill('input[name="orgName"]', company);
  await page.fill('input[name="city"]', city);
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button:has-text("Create free account")');
  await page.waitForURL(/\/dashboard/);
  return email;
}
async function verify(page, email) {
  await page.waitForTimeout(500);
  await page.goto(`/verify-email?token=${tokenFromLog("Verify your email", email)}`);
  await page.waitForSelector("text=Your email is verified");
}
async function logout(page) {
  await page.click('button:has-text("Sign out")');
  await page.waitForURL(BASE + "/");
}
async function login(page, email) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL(/\/dashboard/);
}

try {
  // ───────────── 1. Visitor journey ─────────────
  const visitor = await newPage();
  await visitor.goto("/");
  assert.match(await visitor.textContent("h1"), /Building Materials\. One Platform\./);
  await visitor.fill('input[name="q"]', "cement");
  await visitor.click('button:has-text("Search")');
  await visitor.waitForURL(/\/marketplace\?q=cement/);
  const cards = await visitor.locator("a[href^='/products/']").count();
  assert.ok(cards >= 2, "marketplace shows cement products");
  step(`visitor search returns cement listings (${cards} links)`);
  await shot(visitor, "01-marketplace");
  await visitor.locator("a[href^='/products/']").nth(1).click();
  await visitor.waitForURL(/\/products\//);
  await visitor.waitForSelector("text=Sold by");
  assert.ok(
    (await visitor.locator('script[type="application/ld+json"]').count()) >= 1,
    "product JSON-LD present",
  );
  step("product page renders with structured data");
  await visitor.locator("main a[href^='/suppliers/']").first().click();
  await visitor.waitForURL(/\/suppliers\/[^/]+$/);
  await visitor.waitForSelector("text=Products (");
  step("supplier profile page renders");
  await visitor.goto("/request-quotes?material=cement&city=Sharjah");
  await visitor.waitForURL(/\/login\?next=/);
  step("Request Quotes as visitor redirects to sign in with return path");
  await visitor.goto("/dashboard/orders");
  await visitor.waitForURL(/\/login/);
  step("dashboard is protected for visitors");

  // ───────────── 2. Supplier onboarding + product ─────────────
  const sup = await newPage();
  const supEmail = await register(sup, {
    type: "SUPPLIER",
    company: `E2E Cement Co ${run}`,
    city: "Sharjah",
    name: "Sam Supplier",
  });
  await sup.goto("/dashboard/products/new");
  await sup.fill('input[name="name"]', "E2E Portland Cement 50kg");
  await sup.selectOption('select[name="categoryId"]', { label: "Cement" });
  await sup.selectOption('select[name="unitCode"]', { label: "Bag" });
  await sup.fill('input[name="price"]', "16.50");
  await sup.click('button:has-text("Add product")');
  await sup.waitForSelector("text=Please verify your email address first");
  step("unverified supplier cannot publish a product (error shown)");
  await verify(sup, supEmail);
  await sup.goto("/dashboard/products/new");
  await sup.fill('input[name="name"]', "E2E Portland Cement 50kg");
  await sup.selectOption('select[name="categoryId"]', { label: "Cement" });
  await sup.selectOption('select[name="unitCode"]', { label: "Bag" });
  await sup.fill('input[name="price"]', "16.50");
  await sup.fill('input[name="minOrderQty"]', "50");
  await sup.click('button:has-text("Add product")');
  await sup.waitForURL(/\/dashboard\/products\?saved=1/);
  await sup.waitForSelector("text=E2E Portland Cement 50kg");
  step("supplier onboarding, email verification and product creation");
  await sup.goto("/marketplace?q=E2E+Portland");
  await sup.waitForSelector("text=E2E Portland Cement 50kg");
  step("new product appears in the public marketplace search");

  // ───────────── 3. Contractor RFQ (Get 3 Quotes) ─────────────
  const buyer = await newPage();
  const buyerEmail = await register(buyer, {
    type: "CONTRACTOR",
    company: `E2E Contracting ${run}`,
    city: "Sharjah",
    name: "Cora Contractor",
  });
  await buyer.goto(
    "/dashboard/rfqs/new?material=Portland+cement+50kg&category=cement&city=Sharjah",
  );
  await buyer.fill('input[type="number"]', "200");
  await buyer.selectOption("select >> nth=1", { label: "Bag" });
  await buyer.click('button:has-text("Get 3 Quotes")');
  await buyer.waitForSelector("text=Please verify your email address first");
  step("unverified buyer cannot send an RFQ");
  await verify(buyer, buyerEmail);
  await buyer.goto(
    "/dashboard/rfqs/new?material=Portland+cement+50kg&category=cement&city=Sharjah",
  );
  await buyer.fill('input[type="number"]', "200");
  await buyer.selectOption("select >> nth=1", { label: "Bag" });
  await buyer.click('button:has-text("Get 3 Quotes")');
  await buyer.waitForURL(/\/dashboard\/rfqs\/[^/]+\?sent=1/);
  const rfqUrl = new URL(buyer.url()).pathname;
  await buyer.waitForSelector("text=Request sent to");
  const sentTo = await buyer.locator("text=/Request sent to (\\d+) supplier/").textContent();
  step(`Get 3 Quotes RFQ created and sent (${sentTo.trim()})`);
  await shot(buyer, "02-rfq-sent");

  // ───────────── 4. Supplier responds ─────────────
  await sup.goto("/dashboard/rfqs");
  await sup.waitForSelector("text=RFQ-");
  await sup.click("a:has-text('RFQ-')");
  await sup.waitForSelector("text=Your quote");
  await sup.fill('input[name^="price_"]', "15.75");
  await sup.fill('input[name="deliveryDays"]', "1");
  await sup.fill('input[name="deliveryCost"]', "120");
  await sup.click('button:has-text("Send quote")');
  await sup.waitForSelector("text=Quote sent to the buyer");
  step("supplier viewed RFQ and submitted a quote");

  // ───────────── 5. Buyer compares + accepts ─────────────
  await buyer.goto(rfqUrl);
  await buyer.waitForSelector("text=Compare quotes");
  await buyer.waitForSelector(`text=E2E Cement Co ${run}`);
  const responded = await buyer.locator("text=Responded").count();
  assert.ok(responded >= 1, "recipient status shows Responded");
  await shot(buyer, "03-compare");
  // 15.75 * 200 + 120 = 3270
  await buyer.waitForSelector("text=/3,270\\.00/");
  step("comparison table shows the quote with server-computed total (AED 3,270.00)");
  const row = buyer.locator("tr", { hasText: `E2E Cement Co ${run}` });
  await row.locator('button:has-text("Accept quote")').click();
  await buyer.waitForURL(/\/dashboard\/orders\/[^/]+\?created=1/);
  const orderUrl = new URL(buyer.url()).pathname;
  await buyer.waitForSelector("text=Order created");
  step("accepting a quote created an order");

  // ───────────── 6. Fulfilment + review ─────────────
  await sup.goto(orderUrl);
  for (const label of ["Confirm order", "Start preparing", "Mark dispatched", "Mark delivered"]) {
    await sup.click(`button:has-text("${label}")`);
    await sup.waitForLoadState("networkidle");
  }
  await sup.waitForSelector("text=Delivered");
  step("supplier moved the order Confirmed → Preparing → Dispatched → Delivered");
  await buyer.goto(orderUrl);
  assert.equal(
    await buyer.locator('button:has-text("Mark delivered")').count(),
    0,
    "buyer cannot run supplier steps",
  );
  await buyer.click('button:has-text("Confirm receipt & complete")');
  await buyer.waitForSelector("text=Review this supplier");
  await buyer.selectOption('select[name="rating"]', "5");
  await buyer.fill('textarea[name="comment"]', "Fast and accurate delivery.");
  await buyer.click('button:has-text("Submit review")');
  await buyer.waitForSelector("text=Review: ★★★★★");
  step("buyer completed the order and left a review");
  const supPublic = await newPage();
  await supPublic.goto("/suppliers");
  await supPublic.fill('input[name="q"]', `E2E Cement Co ${run}`);
  await supPublic.click('button:has-text("Filter")');
  await supPublic.click(`a:has-text("E2E Cement Co ${run}")`);
  await supPublic.waitForSelector("text=Fast and accurate delivery.");
  await supPublic.waitForSelector("text=Completed orders");
  step("public supplier profile shows the verified-transaction review and metrics");

  // ───────────── 7. Isolation ─────────────
  const outsider = await newPage();
  await register(outsider, {
    type: "CONTRACTOR",
    company: `Outsider Co ${run}`,
    city: "Dubai",
    name: "Omar Outsider",
  });
  for (const path of [rfqUrl, orderUrl]) {
    const res = await outsider.goto(path);
    assert.equal(res.status(), 404, `outsider must not see ${path}`);
  }
  step("another company gets 404 for someone else's RFQ and order");
  const supOut = await newPage();
  await register(supOut, {
    type: "SUPPLIER",
    company: `Outsider Supply ${run}`,
    city: "Dubai",
    name: "Olga Outsider",
  });
  for (const path of [rfqUrl, orderUrl]) {
    const res = await supOut.goto(path);
    assert.equal(res.status(), 404, `non-recipient supplier must not see ${path}`);
  }
  step("a non-recipient supplier gets 404 for the RFQ and order");
  await supOut.goto("/dashboard/rfqs/new");
  await supOut.waitForSelector("text=Supplier accounts respond to quote requests");
  step("supplier accounts cannot create RFQs");
  const leak = await outsider.request.get("/api/upload");
  assert.ok([401, 404, 405].includes(leak.status()));

  // ───────────── 8. Login / logout / password reset ─────────────
  await logout(buyer);
  await login(buyer, buyerEmail);
  step("logout and login work");
  await logout(buyer);
  await buyer.goto("/forgot-password");
  await buyer.fill('input[name="email"]', buyerEmail);
  await buyer.click('button:has-text("Send reset link")');
  await buyer.waitForSelector("text=If that email is registered");
  await buyer.waitForTimeout(500);
  await buyer.goto(`/reset-password?token=${tokenFromLog("Reset your password", buyerEmail)}`);
  await buyer.fill('input[name="password"]', "NewE2ePassword77");
  await buyer.click('button:has-text("Update password")');
  await buyer.waitForURL(/\/login\?reset=1/);
  await buyer.fill('input[name="email"]', buyerEmail);
  await buyer.fill('input[name="password"]', "NewE2ePassword77");
  await buyer.click('button:has-text("Sign in")');
  await buyer.waitForURL(/\/dashboard/);
  step("forgot / reset password flow works end to end");
  const bad = await newPage();
  await bad.goto("/login");
  await bad.fill('input[name="email"]', buyerEmail);
  await bad.fill('input[name="password"]', "wrong-password-1");
  await bad.click('button:has-text("Sign in")');
  await bad.waitForSelector("text=Invalid email or password");
  step("wrong password is rejected with a generic message");

  // ───────────── 9. Mobile layout ─────────────
  const mobile = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  for (const path of [
    "/",
    "/marketplace",
    "/suppliers",
    "/pricing",
    "/building-materials/cement",
  ]) {
    await mobile.goto(path);
    const overflow = await mobile.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    assert.ok(overflow <= 1, `${path} overflows horizontally by ${overflow}px on mobile`);
  }
  await shot(mobile, "04-mobile-home");
  await mobile.goto("/marketplace");
  await shot(mobile, "05-mobile-marketplace");
  step("public pages have no horizontal overflow at 390px");
  const mb = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await login(mb, buyerEmail).catch(async () => {
    await mb.goto("/login");
    await mb.fill('input[name="email"]', buyerEmail);
    await mb.fill('input[name="password"]', "NewE2ePassword77");
    await mb.click('button:has-text("Sign in")');
    await mb.waitForURL(/\/dashboard/);
  });
  for (const path of ["/dashboard", rfqUrl, orderUrl, "/dashboard/rfqs"]) {
    await mb.goto(path);
    const overflow = await mb.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    assert.ok(overflow <= 1, `${path} overflows horizontally by ${overflow}px on mobile`);
  }
  await mb.goto(rfqUrl);
  await shot(mb, "06-mobile-rfq");
  step("dashboard, RFQ and order pages fit a phone screen");

  console.log("\nALL E2E CHECKS PASSED");
} catch (e) {
  console.error("\nE2E FAILED:", e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
