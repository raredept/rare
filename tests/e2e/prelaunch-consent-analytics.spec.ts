import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { attachDiagnostics, expectNoHorizontalOverflow, labContextOptions, labEnabled, requireEnv, withDatabase } from "./lab-helpers";
import { formatAxeViolations, waitForEntranceAnimations } from "./storefront-fixtures";

// RARE-PRE-LAUNCH-02: cookie consent and consent-aware analytics in a real browser against the
// production build. The main proof: a visitor who refuses (or has not decided) causes zero analytics
// requests, zero analytics identifiers and zero stored events, while the store keeps working.

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1).");
test.setTimeout(180_000);

const ENDPOINT = "/api/analytics/events";
const VISITOR_COOKIE = "rare_analytics_visitor";
const CONSENT_COOKIE = "rare_cookie_consent";

type Visitor = { context: BrowserContext; page: Page; analyticsRequests: string[] };

async function newVisitor(browser: import("@playwright/test").Browser): Promise<Visitor> {
  const context = await browser.newContext(labContextOptions({ cookieConsent: "undecided" }));
  const page = await context.newPage();
  attachDiagnostics(page);
  const analyticsRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === ENDPOINT) analyticsRequests.push(request.postData() ?? "");
  });
  return { context, page, analyticsRequests };
}

async function storedEvents() {
  return withDatabase(async (db) => (await db.query(`SELECT COUNT(*)::int AS n FROM "SiteAnalyticsEvent"`)).rows[0].n as number);
}

async function cookieNames(context: BrowserContext) {
  return (await context.cookies()).map((cookie) => cookie.name);
}

/** A storefront tour: home, catalog, a product card click, the product page, add to cart. */
async function browseStore(page: Page) {
  await page.goto("/");
  await waitForEntranceAnimations(page);
  await page.goto("/categoria/tudo");
  await waitForEntranceAnimations(page);
  const card = page.locator(`a[data-analytics-product="${requireEnv("QA_BF_PRODUCT_ID")}"]`).first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/produto/${requireEnv("QA_BF_PRODUCT_SLUG")}`));
  await waitForEntranceAnimations(page);
  const size = page.getByRole("button", { name: /^M$/ }).first();
  if (await size.isVisible().catch(() => false)) await size.click();
  const add = page.getByRole("button", { name: /Adicionar ao carrinho/i }).first();
  if (await add.isEnabled().catch(() => false)) await add.click();
  // Leave time for any (forbidden) batch to be flushed, then hide the page as a tab switch would.
  await page.waitForTimeout(2_500);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.waitForTimeout(500);
}

test("a new visitor sees the banner with three equally reachable choices, and nothing is tracked before deciding", async ({ browser }) => {
  const before = await storedEvents();
  const visitor = await newVisitor(browser);
  const { page } = visitor;
  await page.goto("/");
  const banner = page.locator("[data-cookie-banner]");
  await expect(banner).toBeVisible();
  for (const name of ["Aceitar", "Recusar não essenciais", "Configurar"]) await expect(banner.getByRole("button", { name, exact: true })).toBeVisible();
  // Refusing is as prominent as accepting: same visual weight.
  const [accept, refuse] = [banner.getByRole("button", { name: "Aceitar", exact: true }), banner.getByRole("button", { name: "Recusar não essenciais", exact: true })];
  expect(await refuse.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(await accept.evaluate((node) => getComputedStyle(node).backgroundColor));

  const results = await new AxeBuilder({ page }).include("[data-cookie-banner]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations, formatAxeViolations(results.violations)).toEqual([]);

  await browseStore(page);
  expect(visitor.analyticsRequests).toEqual([]);
  expect(await cookieNames(visitor.context)).not.toContain(VISITOR_COOKIE);
  expect(await page.evaluate(() => window.sessionStorage.getItem("rare_analytics_session"))).toBeNull();
  expect(await storedEvents()).toBe(before);
  await visitor.context.close();
});

test("refusing: zero analytics requests, identifiers and stored events; the decision survives a reload", async ({ browser }) => {
  const before = await storedEvents();
  const visitor = await newVisitor(browser);
  const { page, context } = visitor;
  await page.goto("/");
  await page.locator("[data-cookie-banner]").getByRole("button", { name: "Recusar não essenciais", exact: true }).click();
  await expect(page.locator("[data-cookie-banner]")).toHaveCount(0);
  const consent = (await context.cookies()).find((cookie) => cookie.name === CONSENT_COOKIE);
  expect(consent?.value).toMatch(/^v1\.a0\.\d{10}$/);

  await browseStore(page);
  await page.reload();
  await expect(page.locator("[data-cookie-banner]")).toHaveCount(0);
  expect(visitor.analyticsRequests).toEqual([]);
  expect(await cookieNames(context)).not.toContain(VISITOR_COOKIE);
  expect(await storedEvents()).toBe(before);

  // A request forged with the refusal cookie stores nothing either (server-side enforcement).
  const forged = await page.evaluate(async (endpoint) => {
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ v: crypto.randomUUID(), s: crypto.randomUUID(), events: [{ type: "page_view", path: "/" }] }) });
    return response.status;
  }, ENDPOINT);
  // 204 (no consent, nothing stored). Over plain http the production build refuses the origin first (403).
  expect([204, 403]).toContain(forged);
  expect(await storedEvents()).toBe(before);
  await context.close();
});

test("accepting: pseudonymous events reach the database, without personal data", async ({ browser }) => {
  const before = await storedEvents();
  const visitor = await newVisitor(browser);
  const { page, context } = visitor;
  await page.goto("/");
  await page.locator("[data-cookie-banner]").getByRole("button", { name: "Aceitar", exact: true }).click();
  await browseStore(page);

  expect(visitor.analyticsRequests.length).toBeGreaterThan(0);
  const visitorId = (await context.cookies()).find((cookie) => cookie.name === VISITOR_COOKIE)?.value;
  expect(visitorId).toMatch(/^[0-9a-f-]{36}$/);
  for (const body of visitor.analyticsRequests) expect(body).not.toMatch(/@|cpf|email|nome|user-?agent/i);

  await expect.poll(storedEvents, { timeout: 10_000 }).toBeGreaterThan(before);
  const rows = await withDatabase(async (db) => (await db.query(`SELECT type, "visitorHash", "sessionHash", path, "productId", device FROM "SiteAnalyticsEvent" ORDER BY "createdAt" DESC LIMIT 50`)).rows);
  const types = new Set(rows.map((row) => row.type));
  for (const type of ["page_view", "product_click", "product_view"]) expect(types.has(type), type).toBe(true);
  expect(rows.every((row) => /^[0-9a-f]{32}$/.test(row.visitorHash) && row.visitorHash !== visitorId)).toBe(true);
  expect(JSON.stringify(rows)).not.toContain(visitorId!);
  await context.close();
});

test("customizing and withdrawing from the footer: the panel, keyboard access and identifiers removed", async ({ browser }) => {
  const visitor = await newVisitor(browser);
  const { page, context } = visitor;
  await page.goto("/");
  await page.locator("[data-cookie-banner]").getByRole("button", { name: "Configurar", exact: true }).click();
  const panel = page.locator("dialog[data-cookie-preferences]");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("rare_analytics_visitor")).toBeVisible();
  await expect(panel.getByText("rare_customer_session")).toBeVisible();
  const toggle = panel.getByRole("switch");
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await panel.getByRole("button", { name: "Salvar preferências" }).click();
  await expect(panel).toBeHidden();
  expect((await context.cookies()).find((cookie) => cookie.name === CONSENT_COOKIE)?.value).toMatch(/^v1\.a1\./);
  await page.goto("/categoria/tudo");
  await expect.poll(async () => cookieNames(context), { timeout: 10_000 }).toContain(VISITOR_COOKIE);

  // Withdraw from the footer, by keyboard.
  const footerButton = page.getByRole("button", { name: "Preferências de Cookies" });
  await footerButton.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("switch")).toBeChecked();
  await panel.getByRole("button", { name: "Recusar não essenciais" }).click();
  await expect(panel).toBeHidden();
  expect(await cookieNames(context)).not.toContain(VISITOR_COOKIE);
  expect(await page.evaluate(() => window.sessionStorage.getItem("rare_analytics_session"))).toBeNull();

  const sentBefore = visitor.analyticsRequests.length;
  const storedBefore = await storedEvents();
  await browseStore(page);
  expect(visitor.analyticsRequests.length).toBe(sentBefore);
  expect(await storedEvents()).toBe(storedBefore);

  // Escape closes the panel.
  await footerButton.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await context.close();
});

test("cookie policy lists the real cookies and the banner fits from 320 to 1920 px", async ({ browser }) => {
  const visitor = await newVisitor(browser);
  const { page, context } = visitor;
  await page.goto("/politica-de-cookies");
  for (const name of ["rare_cookie_consent", "rare_customer_session", "rare_admin_session", "rare_store_cart", "rare_analytics_visitor", "rare_analytics_session"]) {
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
  }
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("[data-cookie-banner]")).toBeVisible();
    await expectNoHorizontalOverflow(page, `banner at ${width}px`);
    for (const name of ["Aceitar", "Recusar não essenciais", "Configurar"]) {
      const box = await page.locator("[data-cookie-banner]").getByRole("button", { name, exact: true }).boundingBox();
      expect(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1, `${name} at ${width}px`).toBe(true);
    }
  }
  await context.close();
});
