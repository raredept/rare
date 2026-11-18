import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { acceptDialogs, attachDiagnostics, enrollAdmin, expectNoHorizontalOverflow, labContextOptions, labEnabled, requireEnv, withDatabase } from "./lab-helpers";

// RARE-PRODUCT-CATALOG-ORDER-01: the seller types "Posição no catálogo" (or uses ↑ / ↓ in the Admin
// list) and the piece takes exactly that place in the storefront; featured pieces no longer jump
// ahead; every move is audited. Real production build, real browser, disposable lab database.

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1).");
test.setTimeout(300_000);

const run = randomBytes(3).toString("hex");
const evidenceDir = path.join("output", "product-catalog-order-01");
const category = { id: `qa_order_cat_${run}`, slug: `qa-ordem-${run}`, name: `QA Ordem ${run}` };
// Inserted newest first: a, b, c, d. "b" is featured (it used to jump to the top of the catalog).
const pieces = ["a", "b", "c", "d"].map((key, index) => ({
  key,
  id: `qa_order_${key}_${run}`,
  slug: `qa-ordem-${key}-${run}`,
  title: `QA Ordem ${key.toUpperCase()} ${run}`,
  featured: key === "b",
  ageMinutes: index,
}));
const byKey = Object.fromEntries(pieces.map((piece) => [piece.key, piece]));
const evidence: Record<string, unknown> = { run };
let seller: { context: BrowserContext; page: Page };

async function storefrontOrder(page: Page) {
  await page.goto(`/categoria/${category.slug}`);
  const hrefs = await page.locator(`a[href^="/produto/qa-ordem-"]`).evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  const keys: string[] = [];
  for (const href of hrefs) {
    const piece = pieces.find((candidate) => href === `/produto/${candidate.slug}`);
    if (piece && !keys.includes(piece.key)) keys.push(piece.key);
  }
  return keys;
}

async function adminOrder(page: Page) {
  const ids = await page.locator('[id^="product-qa_order_"]').evaluateAll((rows) => rows.map((row) => row.id.replace(/^product-/, "")));
  return ids.map((id) => pieces.find((piece) => piece.id === id)?.key ?? "?");
}

async function auditRows() {
  return withDatabase(async (db) =>
    (await db.query(
      `SELECT "actorUserId", action, "entityId", before, after FROM "AdminAuditLog" WHERE action = 'product.catalog_position_changed' AND "entityId" = ANY($1::text[]) ORDER BY "createdAt"`,
      [pieces.map((piece) => piece.id)],
    )).rows as Array<{ actorUserId: string; action: string; entityId: string; before: { position: number }; after: { position: number; total: number; source: string } }>,
  );
}

async function shot(page: Page, name: string) {
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: true });
}

test.beforeAll(async ({ browser }) => {
  await withDatabase(async (db) => {
    await db.query(
      `INSERT INTO "Category" (id, name, slug, active, "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, 90, timezone('UTC', now()), timezone('UTC', now()))`,
      [category.id, category.name, category.slug],
    );
    for (const piece of pieces) {
      await db.query(
        `INSERT INTO "Product" (id, title, slug, description, "shortDescription", "priceInCents", active, featured, "featuredSortOrder", "sortOrder", "categoryId", "weightGrams", "lengthCm", "widthCm", "heightCm", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'Fixture do ciclo de ordem do catálogo.', 'Fixture.', 15000, true, $4, $5, 0, $6, 300, 30, 24, 4, timezone('UTC', now()) - ($7 || ' minutes')::interval, timezone('UTC', now()))`,
        [piece.id, piece.title, piece.slug, piece.featured, piece.featured ? 1 : null, category.id, String(piece.ageMinutes)],
      );
      await db.query(`INSERT INTO "ProductImage" (id, "productId", url, alt, "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, '/seed-products/bone-supreme.svg', 'QA', 0, timezone('UTC', now()), timezone('UTC', now()))`, [`${piece.id}_img`, piece.id]);
      await db.query(`INSERT INTO "ProductVariant" (id, "productId", size, stock, active, "updatedAt") VALUES ($1, $2, 'M', 3, true, timezone('UTC', now()))`, [`${piece.id}_v`, piece.id]);
    }
    // Same starting point as production: every product still carries the old default weight 0.
    await db.query(`UPDATE "Product" SET "sortOrder" = 0`);
  });
  const context = await browser.newContext(labContextOptions());
  context.setDefaultTimeout(20_000);
  const page = await context.newPage();
  acceptDialogs(page);
  attachDiagnostics(page);
  // SELLER_ADMIN: the role the seller uses; it has commerce.products.
  await enrollAdmin(page, requireEnv("QA_MFA_G_LOGIN"), requireEnv("QA_MFA_G_PASSWORD"), new Set());
  seller = { context, page };
});

test.afterAll(async () => {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(path.join(evidenceDir, "evidence.json"), JSON.stringify(evidence, null, 2));
  await seller?.context.close();
});

test("before any change: newest first and the featured piece does not jump ahead", async () => {
  const order = await storefrontOrder(seller.page);
  evidence.initial = order;
  expect(order).toEqual(["a", "b", "c", "d"]);
});

test("the seller types position 2 in the product form and the piece becomes the 2nd of the store", async () => {
  const { page } = seller;
  await page.goto(`/admin/products/${byKey.d.id}/edit`);
  const field = page.locator('input[name="catalogPosition"]');
  const before = Number(await field.inputValue());
  expect(before).toBeGreaterThan(0);
  await expect(page.getByText(new RegExp(`Hoje é a ${before}ª de \\d+ peças`))).toBeVisible();

  // Global position of "b" (2nd of this category): typing it puts "d" right before "b".
  await page.goto(`/admin/products/${byKey.b.id}/edit`);
  const target = Number(await page.locator('input[name="catalogPosition"]').inputValue());
  await page.goto(`/admin/products/${byKey.d.id}/edit`);
  await page.locator('input[name="catalogPosition"]').fill(String(target));
  await page.locator("#admin-product-form button[type=submit]").first().click();
  await expect(page).toHaveURL(/success=product-saved/);
  await expect(page.locator('input[name="catalogPosition"]')).toHaveValue(String(target));
  await shot(page, "01-form-after-save");

  const order = await storefrontOrder(page);
  evidence.afterForm = { typed: target, order };
  expect(order).toEqual(["a", "d", "b", "c"]);
  await shot(page, "02-storefront-after-form");

  const positions = await withDatabase(async (db) => (await db.query(`SELECT "sortOrder" FROM "Product" ORDER BY "sortOrder"`)).rows.map((row) => Number(row.sortOrder)));
  expect(positions).toEqual(positions.map((_, index) => index + 1));
});

test("↑ / ↓ in the Admin list move one place, keep the filter and update the store", async () => {
  const { page } = seller;
  await page.goto(`/admin/products?category=${category.id}`);
  expect(await adminOrder(page)).toEqual(["a", "d", "b", "c"]);
  const firstRow = page.locator(`#product-${byKey.a.id}`);
  await expect(firstRow.getByRole("button", { name: `Subir ${byKey.a.title} uma posição` })).toBeDisabled();
  await expect(page.locator(`#product-${byKey.c.id}`).getByRole("button", { name: `Descer ${byKey.c.title} uma posição` })).toBeDisabled();

  await page.locator(`#product-${byKey.c.id}`).getByRole("button", { name: `Subir ${byKey.c.title} uma posição` }).click();
  await expect(page).toHaveURL(new RegExp(`category=${category.id}.*success=product-moved`));
  await expect(page.getByText("Posição no catálogo atualizada.")).toBeVisible();
  await expect.poll(() => adminOrder(page)).toEqual(["a", "d", "c", "b"]);

  // The URL already says success=product-moved: wait for the list itself to change.
  await page.locator(`#product-${byKey.a.id}`).getByRole("button", { name: `Descer ${byKey.a.title} uma posição` }).click();
  await expect.poll(() => adminOrder(page)).toEqual(["d", "a", "c", "b"]);
  await expect(page).toHaveURL(new RegExp(`category=${category.id}.*success=product-moved`));
  await shot(page, "03-admin-list-after-arrows");

  const order = await storefrontOrder(page);
  evidence.afterArrows = order;
  expect(order).toEqual(["d", "a", "c", "b"]);
});

test("every move is in the audit log with the seller as actor", async () => {
  const rows = await auditRows();
  evidence.audit = rows.map((row) => ({ entityId: row.entityId, before: row.before, after: row.after }));
  expect(rows).toHaveLength(3);
  expect(rows.every((row) => row.actorUserId === "qa_admin_g")).toBe(true);
  expect(rows.map((row) => row.after.source)).toEqual(["form", "arrow", "arrow"]);
  expect(rows.map((row) => row.entityId)).toEqual([byKey.d.id, byKey.c.id, byKey.a.id]);
});

test("the featured order (home / destaques) is untouched by catalog moves", async () => {
  const { page } = seller;
  await page.goto("/categoria/destaques");
  await expect(page.locator(`a[href="/produto/${byKey.b.slug}"]`).first()).toBeVisible();
});

test("the Admin list with arrows fits a 320 px phone without horizontal scroll", async () => {
  const { page } = seller;
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/admin/products?category=${category.id}`);
  await expectNoHorizontalOverflow(page, "admin products 320");
  const arrow = page.locator(`#product-${byKey.d.id}`).getByRole("button", { name: `Descer ${byKey.d.title} uma posição` });
  const box = await arrow.boundingBox();
  expect(box && box.width >= 44 && box.height >= 44).toBe(true);
  await shot(page, "04-admin-list-320");
  await page.setViewportSize({ width: 1280, height: 900 });
});
