import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { acceptDialogs, attachDiagnostics, cookieHeader, enrollAdmin, labBaseUrl, labContextOptions, rawFetch, requireEnv } from "./lab-helpers";

// RARE-PRE-LAUNCH-04: the two scoped roles on the REAL staging (no database access from the test).
// Needs two brand-new QA accounts created in /admin/users (SYSTEM_ADMIN and SELLER_ADMIN, never
// used): the spec enrolls their MFA through the UI, so it runs once per pair of accounts. Then it
// proves, per role: navigation, direct URL, Admin API and a replayed Server Action of the other
// role, and that the replayed mutation changed nothing. Opt-in: STAGING_RBAC=1.
//   STAGING_RBAC=1 PLAYWRIGHT_BASE_URL=<staging> QA_MFA_E_LOGIN/QA_MFA_E_PASSWORD (SYSTEM_ADMIN)
//   QA_MFA_F_LOGIN/QA_MFA_F_PASSWORD (SELLER_ADMIN) + the staging gate (railway run).

test.describe.configure({ mode: "serial" });
test.skip(process.env.STAGING_RBAC !== "1", "Staging only: STAGING_RBAC=1 with two fresh QA admin accounts.");
test.setTimeout(240_000);

const COMMERCE_PAGES = ["/admin", "/admin/orders", "/admin/products", "/admin/customers", "/admin/promotions", "/admin/categories", "/admin/support"];
const SYSTEM_PAGES = ["/admin/users", "/admin/readiness", "/admin/settings", "/admin/security"];

type Session = { context: BrowserContext; page: Page };
let system: Session;
let seller: Session;

async function signIn(browser: Browser, key: "E" | "F"): Promise<Session> {
  const context = await browser.newContext(labContextOptions());
  const page = await context.newPage();
  attachDiagnostics(page);
  await acceptDialogs(page);
  await enrollAdmin(page, requireEnv(`QA_MFA_${key}_LOGIN`), requireEnv(`QA_MFA_${key}_PASSWORD`), new Set());
  await page.getByRole("link", { name: "Já guardei, continuar" }).click();
  return { context, page };
}

async function navHrefs(page: Page) {
  return page.locator('nav[aria-label="Navegação administrativa"] a').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
}

/** The id React renders for a form bound to an unbound Server Action (progressive enhancement). */
async function actionIdOf(form: import("@playwright/test").Locator) {
  const name = await form.locator('input[name^="$ACTION_ID_"]').first().getAttribute("name");
  expect(name, "form without a Server Action id").toBeTruthy();
  return name as string;
}

/** Posts a form exactly as a browser without JavaScript would, with the session cookies given. */
async function replayAction(playwright: Parameters<typeof rawFetch>[0], pathname: string, cookie: string, fields: Record<string, string>) {
  const boundary = `----rare${randomBytes(8).toString("hex")}`;
  const body = Object.entries(fields).map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`).join("") + `--${boundary}--\r\n`;
  return rawFetch(playwright, pathname, {
    method: "POST",
    cookie,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}`, origin: new URL(labBaseUrl()).origin },
    data: Buffer.from(body),
  });
}

function refusedTo(response: { status: number; headers: Record<string, string>; text: string }) {
  const location = response.headers.location ?? response.headers["x-action-redirect"] ?? "";
  return /\/admin\/(sem-acesso|login)/.test(location) || [401, 403].includes(response.status);
}

test.beforeAll(async ({ browser }) => {
  system = await signIn(browser, "E");
  seller = await signIn(browser, "F");
});

test.afterAll(async () => {
  await system?.context.close();
  await seller?.context.close();
});

test("SYSTEM_ADMIN: system areas only; every commercial page is denied by direct URL", async () => {
  const { page } = system;
  await expect(page).toHaveURL(/\/admin\/users$/);
  const hrefs = await navHrefs(page);
  for (const href of SYSTEM_PAGES) expect(hrefs).toContain(href);
  for (const href of COMMERCE_PAGES) expect(hrefs).not.toContain(href);
  for (const path of COMMERCE_PAGES.filter((path) => path !== "/admin")) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin\/sem-acesso$/);
  }
});

test("SELLER_ADMIN: commercial areas and Suporte; every system page is denied by direct URL", async () => {
  const { page } = seller;
  await expect(page).toHaveURL(/\/admin(\?|$)/);
  const hrefs = await navHrefs(page);
  for (const href of COMMERCE_PAGES) expect(hrefs).toContain(href);
  for (const href of SYSTEM_PAGES) expect(hrefs).not.toContain(href);
  for (const path of SYSTEM_PAGES) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin\/sem-acesso$/);
  }
  await page.goto("/admin/support");
  await expect(page.getByRole("heading", { level: 1, name: "Suporte" })).toBeVisible();
});

test("Admin API: media endpoints refuse SYSTEM_ADMIN", async ({ playwright }) => {
  const cookie = await cookieHeader(system.context);
  for (const api of [{ method: "GET", path: "/api/admin/product-images/editor" }, { method: "POST", path: "/api/admin/uploads/presign" }]) {
    const response = await rawFetch(playwright.request, api.path, { method: api.method, cookie, headers: { "content-type": "application/json", origin: new URL(labBaseUrl()).origin }, data: api.method === "GET" ? undefined : "{}" });
    expect(refusedTo(response), `${api.method} ${api.path} answered ${response.status} ${response.headers.location ?? ""}`).toBe(true);
  }
});

test("Server Action: SYSTEM_ADMIN cannot create a category, SELLER_ADMIN cannot revoke an admin's sessions", async ({ playwright }) => {
  // A category Server Action, taken from the seller's page and replayed with the system session.
  await seller.page.goto("/admin/categories");
  const categoryForm = seller.page.locator("form").filter({ has: seller.page.locator('input[name="name"][aria-label="Nome da categoria"]') });
  const categoryAction = await actionIdOf(categoryForm);
  const categoryName = `QA RBAC ${randomBytes(3).toString("hex")}`;
  const asSystem = await replayAction(playwright.request, "/admin/categories", await cookieHeader(system.context), { [categoryAction]: "", name: categoryName, slug: "", parentId: "", sortOrder: "0", active: "on" });
  expect(refusedTo(asSystem), `category action as SYSTEM answered ${asSystem.status} ${asSystem.headers.location ?? asSystem.headers["x-action-redirect"] ?? ""}`).toBe(true);
  await seller.page.goto("/admin/categories");
  await expect(seller.page.getByText(categoryName)).toHaveCount(0);

  // A user-management Server Action, taken from the system page and replayed with the seller session
  // against the seller QA account itself (never anyone else's): if it ran, the seller would be logged out.
  await system.page.goto("/admin/users");
  const sellerRow = system.page.locator("article").filter({ hasText: requireEnv("QA_MFA_F_LOGIN") });
  await expect(sellerRow).toHaveCount(1);
  const revokeForm = sellerRow.locator("form").filter({ has: system.page.getByRole("button", { name: "Encerrar sessões" }) });
  const revokeAction = await actionIdOf(revokeForm);
  const userId = (await revokeForm.locator('input[name="userId"]').getAttribute("value")) ?? "";
  const asSeller = await replayAction(playwright.request, "/admin/users", await cookieHeader(seller.context), { [revokeAction]: "", userId });
  expect(refusedTo(asSeller), `revoke action as SELLER answered ${asSeller.status} ${asSeller.headers.location ?? asSeller.headers["x-action-redirect"] ?? ""}`).toBe(true);
  await seller.page.goto("/admin/support");
  await expect(seller.page, "the seller session survived: the replayed revoke did not run").toHaveURL(/\/admin\/support$/);
});
