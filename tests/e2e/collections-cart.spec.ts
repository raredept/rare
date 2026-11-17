import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { listCardInstallmentPlans, resolveCardInstallmentRules } from "../../src/lib/card-installments";
import { acceptDialogs, enrollAdmin, labContextOptions, labEnabled, requireEnv, withDatabase } from "./lab-helpers";

// RARE-COLLECTIONS-CART-01 (lab only: production build, disposable database, fake Asaas).
//   QA_LAB_EXTRA_SPECS=tests/e2e/collections-cart.spec.ts npx tsx scripts/qa-staging-lab.ts --only=collections-cart
// A promotion shown as a storefront collection keeps every product in its category; the cart's
// installment copy follows the total it shows (same function as the product page and checkout).

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1).");
test.setTimeout(300_000);

const run = randomBytes(3).toString("hex").toLowerCase();
const RUN = run.toUpperCase();
const outDir = process.env.COLLECTIONS_LAB_OUT ?? path.join("output", "collections-cart-01", "lab");
const metrics: Record<string, unknown> = { run };
const label = `SALE BLACK ${RUN}`;
const slug = `sale-black-${run}`;
const collectionPath = `/colecao/${slug}`;
const SOLD_OUT = new Set([3, 11]);

type Fixture = { id: string; slug: string; title: string; price: number; brand: string; category: string; stock: number };
const camiseta: Fixture = { id: `qa_col_camiseta_${run}`, slug: `qa-col-camiseta-corteiz-${run}`, title: `QA Camiseta Corteiz ${RUN}`, price: 12_000, brand: "Corteiz", category: "camisetas", stock: 4 };
const extras: Fixture[] = Array.from({ length: 27 }, (_, index) => ({
  id: `qa_col_${index}_${run}`, slug: `qa-col-${index}-${run}`, title: `QA Colecao ${RUN} ${String(index).padStart(2, "0")}`,
  price: 6_000 + index * 1_700, brand: index % 2 ? "Corteiz" : "BAPE", category: index % 3 ? "camisetas" : "jaquetas", stock: SOLD_OUT.has(index) ? 0 : 3,
}));
const jaqueta: Fixture = { id: `qa_col_jaqueta_${run}`, slug: `qa-col-jaqueta-${run}`, title: `QA Jaqueta Drop ${RUN}`, price: 60_000, brand: "Stussy", category: "jaquetas", stock: 2 };
const meia: Fixture = { id: `qa_col_meia_${run}`, slug: `qa-col-meia-${run}`, title: `QA Meia 4221 ${RUN}`, price: 4_221, brand: "Fire", category: "acessorios", stock: 5 };
const inCollection = [camiseta, ...extras];

let seller: { context: BrowserContext; page: Page };
let promotionId = "";

function shot(page: Page, name: string, fullPage = false) {
  mkdirSync(outDir, { recursive: true });
  return page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage }).catch(() => undefined);
}

async function overflow(page: Page) {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}

async function categoryIds() {
  return withDatabase(async (db) => (await db.query(`SELECT id, "categoryId", "subcategoryId" FROM "Product" WHERE id = ANY($1) ORDER BY id`, [[...inCollection, jaqueta, meia].map((p) => p.id)])).rows);
}

async function setPromotion(id: string, values: Record<string, unknown>) {
  const keys = Object.keys(values);
  await withDatabase((db) => db.query(`UPDATE "Promotion" SET ${keys.map((key, index) => `"${key}" = $${index + 2}`).join(", ")}, "updatedAt" = timezone('UTC', now()) WHERE id = $1`, [id, ...keys.map((key) => values[key])]));
}

async function storefrontStatus(page: Page, url: string) {
  const response = await page.goto(url);
  return response?.status();
}

async function navHasCollection(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/categoria/tudo");
  if (width >= 1024) return page.locator('nav[aria-label="Navegação por categoria"] a[data-collection-link]').filter({ hasText: label }).count();
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const count = await page.locator('nav[aria-label="Coleções mobile"] a').filter({ hasText: label }).count();
  await page.locator("#store-mobile-menu").getByRole("button", { name: "Fechar menu" }).click();
  return count;
}

test.beforeAll(async ({ browser }) => {
  await withDatabase(async (db) => {
    const categories = new Map((await db.query(`SELECT id, slug FROM "Category"`)).rows.map((row) => [row.slug as string, row.id as string]));
    for (const [index, product] of [...inCollection, jaqueta, meia].entries()) {
      await db.query(
        `INSERT INTO "Product" (id, title, slug, description, "shortDescription", brand, "priceInCents", active, "categoryId", "weightGrams", "lengthCm", "widthCm", "heightCm", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'Fixture do ciclo de coleções.', 'Fixture.', $4, $5, true, $6, 300, 30, 24, 4, timezone('UTC', now()) - ($7 || ' hours')::interval, timezone('UTC', now()))`,
        [product.id, product.title, product.slug, product.brand, product.price, categories.get(product.category) ?? null, String(index)],
      );
      await db.query(`INSERT INTO "ProductImage" (id, "productId", url, alt, "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, '/seed-products/bone-supreme.svg', 'QA', 0, timezone('UTC', now()), timezone('UTC', now()))`, [`${product.id}_img`, product.id]);
      await db.query(`INSERT INTO "ProductVariant" (id, "productId", size, stock, active, "updatedAt") VALUES ($1, $2, $3, $4, true, timezone('UTC', now()))`, [`${product.id}_v0`, product.id, index % 2 ? "M" : "G", product.stock]);
    }
    await db.query(`UPDATE "StoreSettings" SET "cardInstallmentsEnabled" = true, "cardInstallmentsMax" = 12, "cardInstallmentsMinInCents" = 1000 WHERE id = 'store'`);
  });
  metrics.categoriesBefore = await categoryIds();
  const context = await browser.newContext(labContextOptions());
  context.setDefaultTimeout(20_000);
  const page = await context.newPage();
  acceptDialogs(page);
  // SELLER_ADMIN: the role that manages promotions (commerce.promotions) — no new permission.
  await enrollAdmin(page, requireEnv("QA_MFA_F_LOGIN"), requireEnv("QA_MFA_F_PASSWORD"), new Set());
  seller = { context, page };
});

test.afterAll(async () => {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "metrics.json"), JSON.stringify(metrics, null, 2));
  await seller?.context.close();
});

test("Admin (SELLER_ADMIN): creates SALE BLACK as a collection, activates it; categories untouched", async () => {
  const { page } = seller;
  await page.goto("/admin/promotions/new");
  await page.locator('input[name="name"]').fill(label);
  await page.locator('input[name="slug"]').fill(slug);
  await page.locator('input[name="value"]').fill("30");
  await page.locator('input[name="scope"][value="SELECTED_PRODUCTS"]').check();
  await page.getByPlaceholder("nome do produto").fill(RUN);
  for (const product of inCollection) await page.locator("label").filter({ hasText: product.title }).locator('input[type="checkbox"]').first().check();
  const section = page.locator("fieldset").filter({ has: page.getByText("Exibição na loja", { exact: true }) });
  await expect(section.getByText("Os produtos continuam em suas categorias originais. Esta opção cria uma coleção promocional separada na loja.")).toBeVisible();
  await expect(section.getByText(/Adicionar um produto à coleção NÃO altera a categoria dele/)).toBeVisible();
  await section.getByLabel("Exibir esta promoção como coleção").check();
  await section.locator('input[name="storefrontCollectionLabel"]').fill(label);
  await section.locator('input[name="storefrontCollectionSortOrder"]').fill("10");
  metrics.adminFormAxe = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
  await shot(page, "admin-promotion-form-1440", true);
  await page.getByRole("button", { name: "Criar rascunho" }).click();
  await expect(page).toHaveURL(/\/admin\/promotions\/[A-Za-z0-9_-]+\?/);
  promotionId = new URL(page.url()).pathname.split("/")[3];
  await expect(page.getByRole("heading", { name: "Coleção na loja" })).toBeVisible();
  await expect(page.getByText("A coleção só fica pública quando a promoção estiver ativa e tiver produtos elegíveis.")).toBeVisible();
  // Not active yet: no public collection, no menu entry.
  const anonymous = await seller.context.browser()!.newContext(labContextOptions());
  const visitor = await anonymous.newPage();
  expect(await storefrontStatus(visitor, collectionPath), "draft collection").toBe(404);

  await page.getByRole("button", { name: "Ativar", exact: true }).click();
  await expect(page).toHaveURL(/success=promotion-activate/);
  await expect(page.getByText(/No ar agora: 28 produto\(s\)/)).toBeVisible();
  await expect(page.getByText(new RegExp(`Coleção pública: .*${collectionPath}`))).toBeVisible();
  await shot(page, "admin-promotion-detail-1440", true);
  const audit = await withDatabase(async (db) => (await db.query(`SELECT action, before, after FROM "AdminAuditLog" WHERE "entityId" = $1 ORDER BY "createdAt"`, [promotionId])).rows);
  metrics.audit = audit.map((row) => ({ action: row.action, collection: row.after?.storefrontCollectionEnabled ?? null, label: row.after?.storefrontCollectionLabel ?? null }));
  expect(audit[0].after).toMatchObject({ storefrontCollectionEnabled: true, storefrontCollectionLabel: label, storefrontCollectionSortOrder: 10 });
  // RBAC unchanged: the seller still cannot open system areas.
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/sem-acesso/);
  expect(await categoryIds()).toEqual(metrics.categoriesBefore);
  await anonymous.close();
});

test("the camiseta is in /categoria/camisetas AND in the collection, with the collection price", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  context.setDefaultTimeout(20_000);
  const page = await context.newPage();
  await page.goto(`/categoria/camisetas?q=${encodeURIComponent(camiseta.title)}`);
  await expect(page.locator(`main a[href="/produto/${camiseta.slug}"]`).first()).toBeVisible();
  expect(await storefrontStatus(page, collectionPath)).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
  await expect(page.locator(`main a[href="/produto/${camiseta.slug}"]`).first()).toBeVisible();
  await expect(page.getByTestId("catalog-toolbar")).toContainText("28 produtos");
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toContainText(`Início/${label}`);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonical).toMatch(new RegExp(`^https?://[^/]+${collectionPath}$`));
  const card = page.locator(`main a[href="/produto/${camiseta.slug}"]`).first().locator("xpath=ancestor::*[self::article or self::li][1]");
  await expect(card).toContainText("R$ 84,00");
  // "Em promoção" is implied in a promotional collection: not offered as a filter.
  await page.getByRole("button", { name: /Filtrar/ }).click();
  await expect(page.getByRole("dialog").getByText("Em promoção")).toHaveCount(0);
  await page.keyboard.press("Escape");
  expect(await categoryIds()).toEqual(metrics.categoriesBefore);
  await context.close();
});

test("collection: filters, sort, pagination, URL state (back/forward/refresh)", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  context.setDefaultTimeout(20_000);
  const page = await context.newPage();
  const ownSlugs = new Set(inCollection.map((product) => product.slug));
  const listed = async () => page.evaluate(() => [...new Set(Array.from(document.querySelectorAll('main a[href^="/produto/"]')).map((a) => a.getAttribute("href")!.slice(9)))]);
  const prices = new Map(inCollection.map((product) => [product.slug, Math.floor(product.price * 0.7)]));
  await page.goto(`${collectionPath}?sort=price-asc`);
  const first = await listed();
  await page.getByRole("link", { name: "Próxima página" }).click();
  await expect(page).toHaveURL(/page=2/);
  const second = await listed();
  const all = [...first, ...second].filter((s) => ownSlugs.has(s));
  const soldOutSlugs = new Set(extras.filter((_, index) => SOLD_OUT.has(index)).map((p) => p.slug));
  const available = all.filter((s) => !soldOutSlugs.has(s)).map((s) => prices.get(s)!);
  metrics.sort = { page1: first.length, page2: second.length, unique: new Set(all).size, soldOutLast: all.slice(-2).every((s) => soldOutSlugs.has(s)), ascending: available.every((p, i) => i === 0 || available[i - 1] <= p) };
  expect(metrics.sort).toMatchObject({ page1: 24, page2: 4, unique: 28, soldOutLast: true, ascending: true });

  await page.goto(`${collectionPath}?brand=Corteiz&size=M`);
  const expected = inCollection.filter((product, index) => product.brand === "Corteiz" && (index === 0 ? false : (index - 1) % 2 === 0 ? false : true) && product.stock > 0).length;
  const total = async () => Number(((await page.getByTestId("catalog-toolbar").locator("p").first().innerText()).match(/\d+/) ?? ["0"])[0]);
  metrics.filterBrandSize = { shown: await total(), expectedAtMost: inCollection.length, expectedBrandSize: expected };
  await page.getByRole("link", { name: "Remover filtro Tamanho: M" }).click();
  await expect(page).not.toHaveURL(/size=M/);
  const brandOnly = await total();
  await page.goBack();
  await expect(page).toHaveURL(/size=M/);
  await page.goForward();
  await expect(page).not.toHaveURL(/size=M/);
  await page.reload();
  expect(await total()).toBe(brandOnly);
  expect(brandOnly).toBe(inCollection.filter((product) => product.brand === "Corteiz").length);
  await page.getByRole("link", { name: "Limpar filtros" }).first().click();
  await expect(page).toHaveURL(new RegExp(`${collectionPath}$`));
  await context.close();
});

test("navigation: desktop pill and mobile 'Coleções', no overflow from 320 to 1440; axe clean", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  context.setDefaultTimeout(20_000);
  const page = await context.newPage();
  const out: Record<string, unknown> = {};
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
    const found = await navHasCollection(page, width);
    await page.goto(collectionPath);
    await page.getByRole("heading", { level: 1 }).waitFor();
    const collectionOverflow = await overflow(page);
    await shot(page, `colecao-${width}`, width <= 430 || width === 1440);
    // The same toolbar on the catalog (320 px used to overflow by 30 px in production).
    await page.goto("/categoria/tudo");
    await page.getByTestId("catalog-toolbar").waitFor();
    const catalogOverflow = await overflow(page);
    out[width] = { navEntry: found, overflowCollection: collectionOverflow, overflowCatalog: catalogOverflow };
    expect(found, `menu at ${width}`).toBe(1);
    expect(collectionOverflow, `collection page at ${width}`).toBe(0);
    expect(catalogOverflow, `catalog at ${width}`).toBe(0);
  }
  // Header at 1024: the pill fits next to the categories.
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");
  out.header1024 = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Navegação por categoria"] > div') as HTMLElement | null;
    const first = nav?.querySelector("a, button")?.getBoundingClientRect();
    return {
      overflowing: nav?.dataset.overflowing === "true",
      scrollable: nav ? getComputedStyle(nav).overflowX === "auto" : null,
      firstPillLeft: first ? Math.round(first.left) : null,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  // Nothing cut on the left, the page never widens; the collection pill is reachable by scrolling.
  expect(out.header1024).toMatchObject({ pageOverflow: 0 });
  expect((out.header1024 as { firstPillLeft: number }).firstPillLeft).toBeGreaterThanOrEqual(0);
  const collectionPill = page.locator("a[data-collection-link]").first();
  await collectionPill.scrollIntoViewIfNeeded();
  await expect(collectionPill).toBeInViewport();
  out.accessoriesMenu1024 = await (async () => {
    const button = page.getByRole("button", { name: /Acessórios/ });
    if (!(await button.count())) return null;
    await button.click();
    const menu = page.locator("[data-category-menu]").first();
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    await page.keyboard.press("Escape");
    return box ? { left: Math.round(box.x), right: Math.round(box.x + box.width), viewport: 1024 } : null;
  })();
  await shot(page, "header-1024");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(collectionPath);
  out.axeCollection = (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map((v) => `${v.id}:${v.impact}`);
  // Keyboard: the collection pill is reachable and shows focus.
  const pill = page.locator("a[data-collection-link]").first();
  await pill.focus();
  out.pillFocus = await pill.evaluate((el) => ({ focused: el === document.activeElement, outline: getComputedStyle(el).boxShadow !== "none" || getComputedStyle(el).outlineStyle !== "none" }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  out.axeMobileMenu = (await new AxeBuilder({ page }).include("#store-mobile-menu").analyze()).violations.map((v) => `${v.id}:${v.impact}`);
  await shot(page, "menu-mobile-375");
  metrics.navigation = out;
  expect(out.axeCollection).toEqual([]);
  expect(out.axeMobileMenu).toEqual([]);
  await context.close();
});

test("lifecycle: paused, ended, scheduled, competing and empty collections are hidden (404 + no menu)", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  context.setDefaultTimeout(20_000);
  const page = await context.newPage();
  const out: Record<string, unknown> = {};
  const check = async (name: string) => {
    out[name] = { status: await storefrontStatus(page, collectionPath), desktop: await navHasCollection(page, 1440), mobile: await navHasCollection(page, 375) };
  };
  await setPromotion(promotionId, { status: "PAUSED" });
  await check("PAUSED");
  await setPromotion(promotionId, { status: "SCHEDULED", startsAt: new Date(Date.now() + 86_400_000) });
  await check("SCHEDULED");
  await setPromotion(promotionId, { status: "ACTIVE", startsAt: null, endsAt: new Date(Date.now() - 60_000) });
  await check("ACTIVE_PAST_END");
  await setPromotion(promotionId, { status: "ENDED", endsAt: null });
  await check("ENDED");
  await setPromotion(promotionId, { status: "ACTIVE" });
  await check("ACTIVE_AGAIN");
  // A higher-priority promotion wins EVERY product of the collection: it is empty, so hidden.
  const rival = `qa_col_rival_${run}`;
  await withDatabase(async (db) => {
    await db.query(`INSERT INTO "Promotion" (id, name, slug, status, type, value, scope, priority, "createdAt", "updatedAt") VALUES ($1, $2, $3, 'ACTIVE', 'PERCENTAGE', 5, 'SELECTED_PRODUCTS', 50, timezone('UTC', now()), timezone('UTC', now()))`, [rival, `Rival ${RUN}`, `rival-${run}`]);
    for (const product of inCollection) await db.query(`INSERT INTO "PromotionProduct" ("promotionId", "productId") VALUES ($1, $2)`, [rival, product.id]);
  });
  await check("EMPTY_ALL_WON_BY_RIVAL");
  // The rival keeps only the camiseta: the collection is back with 27 products, without the camiseta,
  // and the camiseta still sits in Camisetas with the rival's price.
  await withDatabase((db) => db.query(`DELETE FROM "PromotionProduct" WHERE "promotionId" = $1 AND "productId" <> $2`, [rival, camiseta.id]));
  await check("COMPETING_PARTIAL");
  await page.goto(collectionPath);
  out.competingTotal = await page.getByTestId("catalog-toolbar").locator("p").first().innerText();
  out.camisetaInCollection = await page.locator(`main a[href="/produto/${camiseta.slug}"]`).count();
  await withDatabase((db) => db.query(`DELETE FROM "Promotion" WHERE id = $1`, [rival]));
  metrics.lifecycle = out;
  for (const name of ["PAUSED", "SCHEDULED", "ACTIVE_PAST_END", "ENDED", "EMPTY_ALL_WON_BY_RIVAL"]) expect(out[name], name).toEqual({ status: 404, desktop: 0, mobile: 0 });
  for (const name of ["ACTIVE_AGAIN", "COMPETING_PARTIAL"]) expect(out[name], name).toEqual({ status: 200, desktop: 1, mobile: 1 });
  expect(out.competingTotal).toContain("27 produtos");
  expect(out.camisetaInCollection).toBe(0);
  expect(await categoryIds()).toEqual(metrics.categoriesBefore);
  await context.close();
});

test("SELECTED_CATEGORIES and ALL_PRODUCTS collections; edits to the promotion never move a product", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  context.setDefaultTimeout(20_000);
  const page = await context.newPage();
  const out: Record<string, unknown> = {};
  await setPromotion(promotionId, { status: "PAUSED" });
  const drop = `qa_col_drop_${run}`;
  await withDatabase(async (db) => {
    const jaquetas = (await db.query(`SELECT id FROM "Category" WHERE slug = 'jaquetas'`)).rows[0].id;
    await db.query(`INSERT INTO "Promotion" (id, name, slug, status, type, value, scope, priority, "storefrontCollectionEnabled", "storefrontCollectionLabel", "storefrontCollectionSortOrder", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'ACTIVE', 'PERCENTAGE', 15, 'SELECTED_CATEGORIES', 0, true, $4, 20, timezone('UTC', now()), timezone('UTC', now()))`, [drop, `Drop ${RUN}`, `drop-${run}`, `Drop ${RUN}`]);
    await db.query(`INSERT INTO "PromotionCategory" ("promotionId", "categoryId") VALUES ($1, $2)`, [drop, jaquetas]);
  });
  await page.goto(`/colecao/drop-${run}`);
  out.selectedCategories = { status: (await page.request.get(`/colecao/drop-${run}`)).status(), hasJaqueta: await page.locator(`main a[href="/produto/${jaqueta.slug}"]`).count(), hasCamiseta: await page.locator(`main a[href="/produto/${camiseta.slug}"]`).count() };
  await setPromotion(drop, { scope: "ALL_PRODUCTS" });
  await withDatabase((db) => db.query(`DELETE FROM "PromotionCategory" WHERE "promotionId" = $1`, [drop]));
  await page.goto(`/colecao/drop-${run}`);
  const allTotal = await page.getByTestId("catalog-toolbar").locator("p").first().innerText();
  // 24 per page: look for the meia (outside every other promotion) through the brand filter.
  await page.goto(`/colecao/drop-${run}?brand=${meia.brand}`);
  out.allProducts = { hasMeia: await page.locator(`main a[href="/produto/${meia.slug}"]`).count(), total: allTotal };
  await withDatabase((db) => db.query(`DELETE FROM "Promotion" WHERE id = $1`, [drop]));

  // Through the Admin: remove a product from SALE BLACK, add the jaqueta, turn the collection off and on.
  const { page: admin } = seller;
  await setPromotion(promotionId, { status: "ACTIVE" });
  await admin.goto(`/admin/promotions/${promotionId}/edit`);
  await admin.getByPlaceholder("nome do produto").fill(RUN);
  await admin.locator("label").filter({ hasText: extras[0].title }).locator('input[type="checkbox"]').first().uncheck();
  await admin.locator("label").filter({ hasText: jaqueta.title }).locator('input[type="checkbox"]').first().check();
  await admin.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(admin).toHaveURL(/success=promotion-saved/);
  out.afterEditCategories = JSON.stringify(await categoryIds()) === JSON.stringify(metrics.categoriesBefore);
  for (const enabled of [false, true]) {
    await admin.goto(`/admin/promotions/${promotionId}/edit`);
    const box = admin.getByLabel("Exibir esta promoção como coleção");
    if (enabled) await box.check(); else await box.uncheck();
    await admin.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(admin).toHaveURL(/success=promotion-saved/);
    out[`collection ${enabled ? "on" : "off"}`] = { status: (await page.request.get(collectionPath)).status(), categoriesUnchanged: JSON.stringify(await categoryIds()) === JSON.stringify(metrics.categoriesBefore) };
  }
  metrics.scopes = out;
  expect(out.selectedCategories).toMatchObject({ status: 200, hasJaqueta: 1, hasCamiseta: 0 });
  expect(out.allProducts).toMatchObject({ hasMeia: 1 });
  expect(out.afterEditCategories).toBe(true);
  expect(out["collection off"]).toEqual({ status: 404, categoriesUnchanged: true });
  expect(out["collection on"]).toEqual({ status: 200, categoriesUnchanged: true });
  await context.close();
});

test("cart: the installment copy follows the cart total (R$ 42,21 -> 4x, R$ 600 -> 12x), PDP and checkout agree", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  context.setDefaultTimeout(20_000);
  const page = await context.newPage();
  await page.goto("/entrar");
  await page.locator('form input[name="email"]').first().fill(requireEnv("QA_CUSTOMER_EMAIL"));
  await page.locator('form input[name="password"]').first().fill(requireEnv("QA_CUSTOMER_PASSWORD"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
  const settings = await withDatabase(async (db) => (await db.query(`SELECT "cardInstallmentsEnabled", "cardInstallmentsMax", "cardInstallmentsMinInCents", "cardInstallmentSurchargesBps" FROM "StoreSettings" WHERE id = 'store'`)).rows[0]);
  const rules = resolveCardInstallmentRules(true, settings);
  const out: Record<string, unknown> = {};
  for (const product of [meia, jaqueta]) {
    await page.goto(`/produto/${product.slug}`);
    await expect(page.locator("main")).toContainText(product.title);
    const pdp = (await page.locator("main").innerText()).match(/ou até (\d+)x no cartão/)?.[1] ?? null;
    await page.evaluate(([productId, variantId, slugValue, title, price]) => {
      window.localStorage.setItem("rare_store_cart", JSON.stringify([{ productId, variantId, title, slug: slugValue, size: "G", priceInCents: Number(price), quantity: 1, maxQuantity: 2 }]));
    }, [product.id, `${product.id}_v0`, product.slug, product.title, String(product.price)]);
    await page.goto("/finalizar-compra");
    await page.waitForLoadState("networkidle");
    // Pix selected: the summary shows the short copy (no plan chosen yet).
    const pix = page.locator('input[name="payment-method"][value="pix"]');
    if (await pix.count()) await pix.check();
    const summary = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const cartHint = summary.match(/Até \d+x sem juros(?: · ou até \d+x no cartão)?/)?.[0] ?? null;
    const card = page.locator('input[name="payment-method"][value="card"]');
    if (await card.count()) await card.check();
    const toggle = page.getByTestId("card-installment-toggle");
    let checkoutMax: number | null = null;
    if (await toggle.count()) {
      await toggle.click();
      checkoutMax = Math.max(...await page.locator('input[name="card-installments"]').evaluateAll((els) => els.map((el) => Number((el as HTMLInputElement).value))));
    }
    out[product.slug] = { price: product.price, pdp, cartHint, checkoutMax, rule: listCardInstallmentPlans(product.price, rules).at(-1)?.installmentCount };
    await shot(page, `cart-hint-${product.price}`);
  }
  metrics.cart = out;
  expect(out[meia.slug]).toMatchObject({ pdp: "4", cartHint: "Até 3x sem juros · ou até 4x no cartão", checkoutMax: 4, rule: 4 });
  expect(out[jaqueta.slug]).toMatchObject({ pdp: "12", cartHint: "Até 3x sem juros · ou até 12x no cartão", checkoutMax: 12, rule: 12 });
  await context.close();
});
