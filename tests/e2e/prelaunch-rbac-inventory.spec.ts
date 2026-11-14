import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { acceptDialogs, attachDiagnostics, enrollAdmin, expectNoHorizontalOverflow, labContextOptions, labEnabled, requireEnv, withDatabase } from "./lab-helpers";

// RARE-PRE-LAUNCH-02: the two scoped roles through the real UI (password + TOTP enrollment), the
// new Admin screens (users, own account, security, access denied, site analytics) across widths with
// axe, and a one-of-a-kind product through available -> sold -> inconsistent.

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1).");
test.setTimeout(300_000);

const COMMERCE_PAGES = ["/admin/orders", "/admin/products", "/admin/customers", "/admin/promotions", "/admin/categories", "/admin/banners", "/admin/notifications", "/admin/analytics"];
const SYSTEM_PAGES = ["/admin/users", "/admin/readiness", "/admin/settings", "/admin/security"];
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

type Session = { context: BrowserContext; page: Page };
let system: Session;
let seller: Session;
const uniqueProduct = { id: `qa_unique_${randomBytes(4).toString("hex")}`, slug: `qa-peca-unica-${randomBytes(3).toString("hex")}`, variantId: "", title: "QA Jaqueta Peça Única" };
const createdOrders: string[] = [];

async function signIn(browser: import("@playwright/test").Browser, key: "E" | "F"): Promise<Session> {
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

async function axe(page: Page, label: string) {
  // The Admin enters with a short fade; axe must read the final colours.
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`), label).toEqual([]);
}

async function paidOrder() {
  const id = `qa_unique_order_${randomBytes(4).toString("hex")}`;
  createdOrders.push(id);
  await withDatabase(async (db) => {
    await db.query(
      `INSERT INTO "Order" (id, "orderNumber", "subtotalInCents", "totalInCents", status, "paymentProvider", "paidAt", "createdAt", "updatedAt")
       VALUES ($1, $2, 90000, 90000, 'paid', 'asaas', timezone('UTC', now()), timezone('UTC', now()), timezone('UTC', now()))`,
      [id, `RARE-QA-UNQ-${randomBytes(3).toString("hex")}`],
    );
    await db.query(
      `INSERT INTO "OrderItem" (id, "orderId", "productId", "productTitleSnapshot", "variantId", "sizeSnapshot", quantity, "unitPriceInCents", "totalInCents", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'Único', 1, 90000, 90000, timezone('UTC', now()), timezone('UTC', now()))`,
      [`${id}_item`, id, uniqueProduct.id, uniqueProduct.title, uniqueProduct.variantId],
    );
  });
}

test.beforeAll(async ({ browser }) => {
  await withDatabase(async (db) => {
    await db.query(
      `INSERT INTO "Product" (id, title, slug, description, "shortDescription", "priceInCents", active, "stockPolicy", "weightGrams", "lengthCm", "widthCm", "heightCm", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'Peça única sintética de QA.', 'Peça única de QA', 90000, true, 'UNIQUE', 900, 40, 30, 8, timezone('UTC', now()), timezone('UTC', now()))`,
      [uniqueProduct.id, uniqueProduct.title, uniqueProduct.slug],
    );
    uniqueProduct.variantId = `${uniqueProduct.id}_v`;
    await db.query(
      `INSERT INTO "ProductVariant" (id, "productId", size, stock, "reservedStock", active, "createdAt", "updatedAt") VALUES ($1, $2, 'Único', 1, 0, true, timezone('UTC', now()), timezone('UTC', now()))`,
      [uniqueProduct.variantId, uniqueProduct.id],
    );
    await db.query(`INSERT INTO "ProductImage" (id, "productId", url, alt, "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, '/seed-products/bermuda-adidas.svg', $3, 0, timezone('UTC', now()), timezone('UTC', now()))`, [`${uniqueProduct.id}_img`, uniqueProduct.id, uniqueProduct.title]);
  });
  system = await signIn(browser, "E");
  seller = await signIn(browser, "F");
});

test.afterAll(async () => {
  await system?.context.close();
  await seller?.context.close();
  // Synthetic fixtures out of the way of the other specs and the integrity checks of the runner.
  await withDatabase(async (db) => {
    await db.query(`DELETE FROM "Order" WHERE id = ANY($1::text[])`, [createdOrders]);
    await db.query(`DELETE FROM "Product" WHERE id = $1`, [uniqueProduct.id]);
  }).catch(() => undefined);
});

test("SYSTEM_ADMIN lands on users, sees only system areas and site analytics, and is denied every commercial page", async () => {
  const { page } = system;
  await expect(page).toHaveURL(/\/admin\/users$/);
  const hrefs = await navHrefs(page);
  for (const href of [...SYSTEM_PAGES, "/admin/analytics/site", "/admin/conta"]) expect(hrefs).toContain(href);
  for (const href of ["/admin", ...COMMERCE_PAGES]) expect(hrefs).not.toContain(href);
  for (const path of COMMERCE_PAGES) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin\/sem-acesso$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sem acesso a esta área" })).toBeVisible();
  }
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/users$/);
  await page.goto("/admin/analytics/site");
  await expect(page.getByRole("heading", { level: 1, name: "Analytics do site" })).toBeVisible();
});

test("SELLER_ADMIN lands on the dashboard, sees only commercial areas and site analytics, and is denied every system page", async () => {
  const { page } = seller;
  await expect(page).toHaveURL(/\/admin(\?|$)/);
  const hrefs = await navHrefs(page);
  for (const href of ["/admin", ...COMMERCE_PAGES, "/admin/analytics/site", "/admin/conta"]) expect(hrefs).toContain(href);
  for (const href of SYSTEM_PAGES) expect(hrefs).not.toContain(href);
  for (const path of SYSTEM_PAGES) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin\/sem-acesso$/);
  }
});

test("site analytics shows the consented session of the consent spec and the server-side purchase figures", async () => {
  const { page } = seller;
  await page.goto("/admin/analytics/site?period=today");
  const tile = (label: string) => page.locator("div").filter({ has: page.getByText(label, { exact: true }) }).locator("p.text-2xl").first();
  expect(Number((await tile("Visitantes").innerText()).replace(/\D/g, ""))).toBeGreaterThanOrEqual(1);
  expect(Number((await tile("Páginas vistas").innerText()).replace(/\D/g, ""))).toBeGreaterThanOrEqual(1);
  await expect(page.getByText("Compras confirmadas", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/sem nome, e-mail, CPF, telefone ou IP/)).toBeVisible();
});

test("a one-of-a-kind piece: 1 unit is available and never critical", async () => {
  const { page } = seller;
  await page.goto("/admin/products?stock=unique");
  const row = page.locator("div.grid").filter({ hasText: uniqueProduct.title }).first();
  await expect(row.getByText("Peça única", { exact: true })).toBeVisible();
  await expect(row.getByText("Disponível", { exact: true })).toBeVisible();
  await expect(row).not.toContainText(/Estoque crítico|Estoque baixo|Inconsistente/);
  await page.goto("/admin/products?stock=low");
  await expect(page.getByText(uniqueProduct.title)).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Estoque crítico" }) })).not.toContainText(uniqueProduct.title);
});

test("a one-of-a-kind piece: 0 after its sale is sold, never critical", async () => {
  await withDatabase((db) => db.query(`UPDATE "ProductVariant" SET stock = 0 WHERE id = $1`, [uniqueProduct.variantId]));
  await paidOrder();
  const { page } = seller;
  await page.goto("/admin/products?stock=unique-unavailable");
  const row = page.locator("div.grid").filter({ hasText: uniqueProduct.title }).first();
  await expect(row.getByText("Vendida", { exact: true })).toBeVisible();
  await expect(row).not.toContainText(/Estoque crítico|Esgotad|Inconsistente/);
  await page.goto("/admin");
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Estoque crítico" }) })).not.toContainText(uniqueProduct.title);
  await system.page.goto("/admin/readiness");
  await expect(system.page.getByText(`${uniqueProduct.title} com estoque inconsistente`)).toHaveCount(0);
  await expect(system.page.getByText(`${uniqueProduct.title} sem estoque disponivel`)).toHaveCount(0);
});

test("a one-of-a-kind piece sold twice is inconsistent: critical for the seller, a blocker in readiness", async () => {
  await paidOrder();
  const { page } = seller;
  await page.goto("/admin/products?stock=unique");
  const row = page.locator("div.grid").filter({ hasText: uniqueProduct.title }).first();
  await expect(row.getByText("Inconsistente", { exact: true })).toBeVisible();
  await expect(row).toContainText("Peça única vendida mais de uma vez");
  await page.goto("/admin");
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Estoque crítico" }) })).toContainText(uniqueProduct.title);
  await system.page.goto("/admin/readiness");
  await expect(system.page.getByText(`${uniqueProduct.title} com estoque inconsistente`)).toBeVisible();
});

test("new Admin screens: no horizontal overflow from 320 to 1920 px and no axe violation", async () => {
  const screens: Array<[Session, string]> = [
    [system, "/admin/users"], [system, "/admin/conta"], [system, "/admin/security"], [system, "/admin/sem-acesso"], [system, "/admin/analytics/site"],
    [seller, "/admin/conta"], [seller, "/admin/sem-acesso"], [seller, "/admin/products?stock=unique"],
  ];
  for (const [session, path] of screens) {
    for (const width of WIDTHS) {
      await session.page.setViewportSize({ width, height: 900 });
      await session.page.goto(path);
      await expect(session.page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(session.page, `${path} at ${width}px`);
    }
    await session.page.setViewportSize({ width: 1440, height: 1000 });
    await session.page.goto(path);
    await axe(session.page, path);
  }
});

test("keyboard: the users screen is operable without a mouse and focus stays visible", async () => {
  const { page } = system;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/users");
  const seen: string[] = [];
  // Every account card adds several controls; walk until the create form is reached (bounded).
  for (let index = 0; index < 250 && !seen.some((entry) => entry.startsWith("Criar conta")); index += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      const visible = style.outlineStyle !== "none" || style.boxShadow !== "none";
      return { label: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40) ?? element.tagName, visible };
    });
    if (focused) seen.push(`${focused.label}|${focused.visible}`);
  }
  for (const control of ["Salvar papel", "Criar conta"]) {
    const entry = seen.find((value) => value.startsWith(control));
    expect(entry, `${control} reachable by Tab`).toBeDefined();
    expect(entry!.endsWith("|true"), `${control} shows a focus indicator`).toBe(true);
  }
});
