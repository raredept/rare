import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { acceptDialogs, attachDiagnostics, enrollAdmin, expectNoHorizontalOverflow, formAlert, labContextOptions, labEnabled, requireEnv, withDatabase } from "./lab-helpers";

// RARE-ORDER-ITEM-IMAGE-01: SKU in the catalog (Admin field, normalization, uniqueness, search) and
// the order item photo + SKU in Admin > Pedidos > Detalhes, from the order snapshot, for orders
// created before the snapshot (fallback) and with missing or failing images.

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1).");
test.setTimeout(300_000);

const run = randomBytes(3).toString("hex").toUpperCase();
const evidenceDir = path.join("output", "order-item-image-01");
const IMAGE = "/brand/rare-logo.png";
const MISSING_IMAGE = `/uploads/qa-missing-${run.toLowerCase()}-rare-v1-original.jpg`;
const product = { id: `qa_sku_a_${run.toLowerCase()}`, slug: `qa-camiseta-corteiz-${run.toLowerCase()}`, title: `QA Camiseta Corteiz ${run}` };
const other = { id: `qa_sku_b_${run.toLowerCase()}`, slug: `qa-camiseta-corteiz-branca-${run.toLowerCase()}`, title: `QA Camiseta Corteiz Branca ${run}` };
const SKU_G = `QA${run}-CRTZ-BLK-G`;
const SKU_G_NEW = `QA${run}-CRTZ-BLK-G2`;
const SKU_DUP = `QA${run}-CRTZ-WHT-UN`;
const orders = {
  snapshot: { id: `qa_sku_order_snap_${run.toLowerCase()}`, number: `RARE-QA-SKU-${run}-1` },
  legacy: { id: `qa_sku_order_old_${run.toLowerCase()}`, number: `RARE-QA-SKU-${run}-2` },
  broken: { id: `qa_sku_order_broken_${run.toLowerCase()}`, number: `RARE-QA-SKU-${run}-3` },
};
let createdProductId: string | null = null;
let seller: { context: BrowserContext; page: Page };

async function insertOrder(order: { id: string; number: string }) {
  await withDatabase((db) =>
    db.query(
      `INSERT INTO "Order" (id, "orderNumber", "customerNameSnapshot", "customerEmailSnapshot", "subtotalInCents", "totalInCents", status, "paymentProvider", "paidAt", "createdAt", "updatedAt")
       VALUES ($1, $2, 'Cliente QA', 'cliente.qa@homologacao.rare.invalid', 2400, 2400, 'paid', 'asaas', timezone('UTC', now()), timezone('UTC', now()), timezone('UTC', now()))`,
      [order.id, order.number],
    ),
  );
}

async function insertItem(values: { id: string; orderId: string; productId: string; variantId: string; title: string; size: string; sku: string | null; image: string | null; snapshot: boolean }) {
  await withDatabase((db) =>
    db.query(
      `INSERT INTO "OrderItem" (id, "orderId", "productId", "productTitleSnapshot", "variantId", "sizeSnapshot", quantity, "unitPriceInCents", "totalInCents", "skuSnapshot", "imageUrlSnapshot", "catalogSnapshotAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 1, 1200, 1200, $7, $8, CASE WHEN $9::boolean THEN timezone('UTC', now()) END, timezone('UTC', now()), timezone('UTC', now()))`,
      [values.id, values.orderId, values.productId, values.title, values.variantId, values.size, values.sku, values.image, values.snapshot],
    ),
  );
}

async function variantSkus(productId: string) {
  return withDatabase(async (db) => (await db.query(`SELECT size, sku FROM "ProductVariant" WHERE "productId" = $1 ORDER BY size`, [productId])).rows as Array<{ size: string; sku: string | null }>);
}

async function shot(page: Page, name: string) {
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: true });
}

async function itemByTitle(page: Page, title: string) {
  return page.getByTestId("admin-order-item").filter({ hasText: title });
}

/** The thumbnail of an item: a loaded image (never broken) or the placeholder. */
async function thumbnailState(page: Page, title: string) {
  const item = await itemByTitle(page, title);
  const box = item.getByTestId("admin-order-item-thumbnail");
  await expect(box).toBeVisible();
  const bounds = await box.boundingBox();
  const state = await box.evaluate(async (element) => {
    const image = element.querySelector("img");
    if (image) {
      if (!image.complete) await new Promise((resolve) => { image.addEventListener("load", resolve, { once: true }); image.addEventListener("error", resolve, { once: true }); });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const current = element.querySelector("img");
    const style = current ? getComputedStyle(current) : null;
    return {
      placeholder: Boolean(element.querySelector('[data-testid="admin-order-item-placeholder"]')),
      loaded: current ? current.complete && current.naturalWidth > 0 : false,
      src: current?.currentSrc ?? null,
      objectFit: style?.objectFit ?? null,
      radius: getComputedStyle(element).borderTopLeftRadius,
    };
  });
  // Rounded: layout boxes carry subpixel noise (e.g. 100.00001).
  return { ...state, width: Math.round(bounds?.width ?? 0), height: Math.round(bounds?.height ?? 0) };
}

test.beforeAll(async ({ browser }) => {
  await withDatabase(async (db) => {
    for (const entry of [product, other]) {
      await db.query(
        `INSERT INTO "Product" (id, title, slug, description, "shortDescription", brand, "priceInCents", active, "weightGrams", "lengthCm", "widthCm", "heightCm", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'Camiseta sintética de QA.', 'Camiseta de QA', 'Corteiz', 1200, true, 300, 30, 25, 3, timezone('UTC', now()), timezone('UTC', now()))`,
        [entry.id, entry.title, entry.slug],
      );
    }
    await db.query(`INSERT INTO "ProductImage" (id, "productId", url, alt, "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, 0, timezone('UTC', now()), timezone('UTC', now()))`, [`${product.id}_img`, product.id, IMAGE, product.title]);
    await db.query(
      `INSERT INTO "ProductVariant" (id, "productId", size, sku, stock, "reservedStock", active, "createdAt", "updatedAt") VALUES
       ($1, $2, 'M', NULL, 3, 0, true, timezone('UTC', now()), timezone('UTC', now())),
       ($3, $2, 'G', $4, 2, 0, true, timezone('UTC', now()), timezone('UTC', now())),
       ($5, $6, 'Único', $7, 1, 0, true, timezone('UTC', now()), timezone('UTC', now()))`,
      [`${product.id}_m`, product.id, `${product.id}_g`, SKU_G, `${other.id}_u`, other.id, SKU_DUP],
    );
  });

  // Created as the checkout does: SKU and image captured at purchase time.
  await insertOrder(orders.snapshot);
  await insertItem({ id: `${orders.snapshot.id}_a`, orderId: orders.snapshot.id, productId: product.id, variantId: `${product.id}_g`, title: product.title, size: "G", sku: SKU_G, image: IMAGE, snapshot: true });
  await insertItem({ id: `${orders.snapshot.id}_b`, orderId: orders.snapshot.id, productId: other.id, variantId: `${other.id}_u`, title: other.title, size: "Único", sku: null, image: null, snapshot: true });
  // Created before this cycle: no snapshot at all.
  await insertOrder(orders.legacy);
  await insertItem({ id: `${orders.legacy.id}_a`, orderId: orders.legacy.id, productId: product.id, variantId: `${product.id}_g`, title: product.title, size: "G", sku: null, image: null, snapshot: false });
  // Snapshot pointing at a file that no longer exists in storage.
  await insertOrder(orders.broken);
  await insertItem({ id: `${orders.broken.id}_a`, orderId: orders.broken.id, productId: product.id, variantId: `${product.id}_g`, title: product.title, size: "G", sku: SKU_G, image: MISSING_IMAGE, snapshot: true });

  const context = await browser.newContext(labContextOptions());
  const page = await context.newPage();
  attachDiagnostics(page);
  await acceptDialogs(page);
  await enrollAdmin(page, requireEnv("QA_MFA_G_LOGIN"), requireEnv("QA_MFA_G_PASSWORD"), new Set());
  await page.getByRole("link", { name: "Já guardei, continuar" }).click();
  seller = { context, page };
});

test.afterAll(async () => {
  await seller?.context.close();
  await withDatabase(async (db) => {
    await db.query(`DELETE FROM "Order" WHERE id = ANY($1::text[])`, [Object.values(orders).map((order) => order.id)]);
    await db.query(`DELETE FROM "Product" WHERE id = ANY($1::text[])`, [[product.id, other.id, createdProductId].filter(Boolean)]);
  }).catch(() => undefined);
});

test("a product is created with no SKU at all and keeps selling (SKU is optional, stored as NULL)", async () => {
  const { page } = seller;
  const title = `QA Produto Sem SKU ${run}`;
  await page.goto("/admin/products/new");
  await page.locator('input[name="title"]').fill(title);
  await page.locator('input[name="shortDescription"]').fill("Sem SKU");
  await page.locator('textarea[name="description"]').fill("Produto de QA sem SKU.");
  await page.locator('input[name="price"]').fill("R$ 50,00");
  await page.locator('input[name="weightGrams"]').fill("300");
  await page.locator('input[name="heightCm"]').fill("3");
  await page.locator('input[name="widthCm"]').fill("25");
  await page.locator('input[name="lengthCm"]').fill("30");
  await page.getByLabel("Tamanho da variação 1").fill("Único");
  await page.getByLabel("Estoque da variação 1").fill("2");
  await expect(page.getByLabel("SKU da variação 1")).toHaveAttribute("placeholder", "Ex.: CRTZ-TSH-BLK-G");
  await expect(page.getByText("Código interno usado para identificar o item no estoque.")).toBeVisible();
  await page.getByRole("button", { name: "Criar produto" }).click();
  await expect(page).toHaveURL(/success=product-created/);
  const row = await withDatabase(async (db) => (await db.query(`SELECT p.id, p.active, v.size, v.stock, v.sku FROM "Product" p JOIN "ProductVariant" v ON v."productId" = p.id WHERE p.title = $1`, [title])).rows);
  expect(row).toHaveLength(1);
  createdProductId = row[0].id;
  expect(row[0]).toMatchObject({ active: true, size: "Único", stock: 2, sku: null });
});

test("SKU per variant: shown beside size and stock, saved normalized, edited", async () => {
  const { page } = seller;
  await page.goto(`/admin/products/${product.id}/edit`);
  const rows = page.getByTestId("product-variant-rows").locator("li");
  await expect(rows).toHaveCount(2);
  // The edit page lists variants by size: G, then M.
  await expect(page.getByLabel("Tamanho da variação 1")).toHaveValue("G");
  await expect(page.getByLabel("SKU da variação 1")).toHaveValue(SKU_G);
  await expect(page.getByLabel("SKU da variação 2")).toHaveValue("");
  await page.getByLabel("SKU da variação 2").fill(`  qa${run.toLowerCase()}-crtz-blk-m `);
  await page.getByLabel("SKU da variação 1").fill(SKU_G_NEW);
  await shot(page, "admin-product-sku-desktop");
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page).toHaveURL(/success=product-saved/);
  await expect(page.getByLabel("SKU da variação 2")).toHaveValue(`QA${run}-CRTZ-BLK-M`);
  expect(await variantSkus(product.id)).toEqual([
    { size: "G", sku: SKU_G_NEW },
    { size: "M", sku: `QA${run}-CRTZ-BLK-M` },
  ]);
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/admin/products/${product.id}/edit`);
    await expect(page.getByLabel("SKU da variação 2")).toBeVisible();
    await expectNoHorizontalOverflow(page, `product form ${width}`);
    if (width === 375) {
      await page.getByTestId("product-variant-rows").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidenceDir, "admin-product-sku-mobile-375.png") });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("a SKU already used by another item is refused with the friendly message, nothing saved", async () => {
  const { page } = seller;
  await page.goto(`/admin/products/${product.id}/edit`);
  await page.getByLabel("SKU da variação 2").fill(SKU_DUP.toLowerCase());
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(formAlert(page).filter({ hasText: "Este SKU já está sendo utilizado por outro item." })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/unique constraint|prisma|P2002/i);
  expect((await variantSkus(product.id)).find((variant) => variant.size === "M")?.sku).toBe(`QA${run}-CRTZ-BLK-M`);
  await shot(page, "admin-product-sku-duplicate");
});

test("product search finds by SKU; order search finds by the SKU recorded on the order", async () => {
  const { page } = seller;
  await page.goto(`/admin/products?q=${encodeURIComponent(`qa${run.toLowerCase()}-crtz-blk-m`)}`);
  await expect(page.getByText(product.title, { exact: true })).toBeVisible();
  await expect(page.getByTestId("product-row-skus").first()).toContainText(`M: QA${run}-CRTZ-BLK-M`);
  await page.goto(`/admin/orders?q=${encodeURIComponent(SKU_G)}`);
  await expect(page.getByText(orders.snapshot.number)).toBeVisible();
  await expect(page.getByText(orders.broken.number)).toBeVisible();
  // The legacy order has no recorded SKU, so a search by SKU does not claim it.
  await expect(page.getByText(orders.legacy.number)).toHaveCount(0);
});

test("order detail (desktop): photo, name, size, SKU, quantity and price from the snapshot, unchanged by the catalog edit", async () => {
  const { page } = seller;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/admin/orders/${orders.snapshot.id}`);
  const first = await itemByTitle(page, product.title);
  await expect(first).toContainText("Tamanho G · Qtd 1");
  await expect(first).toContainText(`SKU: ${SKU_G}`);
  await expect(first).not.toContainText(SKU_G_NEW);
  await expect(first).toContainText(/R\$\s?12,00/);
  const photo = await thumbnailState(page, product.title);
  expect(photo).toMatchObject({ placeholder: false, loaded: true, objectFit: "cover" });
  expect(photo.width).toBeGreaterThanOrEqual(80);
  expect(photo.width).toBeLessThanOrEqual(100);
  expect(photo.height).toBeLessThanOrEqual(100);
  expect(photo.radius).not.toBe("0px");

  const second = await itemByTitle(page, other.title);
  await expect(second).not.toContainText("SKU");
  await expect(second).not.toContainText(/null|undefined/);
  expect(await thumbnailState(page, other.title)).toMatchObject({ placeholder: true });
  await expectNoHorizontalOverflow(page, "order detail 1440");
  await page.waitForTimeout(400);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.map((violation) => violation.id)).toEqual([]);
  await shot(page, "admin-order-detail-desktop");
});

test("order detail (mobile 320-430): no horizontal overflow, thumbnail kept in proportion", async () => {
  const { page } = seller;
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/admin/orders/${orders.snapshot.id}`);
    await expect(await itemByTitle(page, product.title)).toContainText(`SKU: ${SKU_G}`);
    const photo = await thumbnailState(page, product.title);
    expect(photo.loaded, `${width}px`).toBe(true);
    expect(Math.round((photo.height / photo.width) * 100), `${width}px ratio`).toBe(125);
    await expectNoHorizontalOverflow(page, `order detail ${width}`);
    if (width === 375) await shot(page, "admin-order-detail-mobile-375");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("an order created before the snapshot renders from the current catalog, its SKU labelled as current", async () => {
  const { page } = seller;
  await page.goto(`/admin/orders/${orders.legacy.id}`);
  const item = await itemByTitle(page, product.title);
  await expect(item).toContainText(`SKU atual: ${SKU_G_NEW}`);
  await expect(item).toContainText("do catálogo hoje");
  expect(await thumbnailState(page, product.title)).toMatchObject({ placeholder: false, loaded: true });
  await shot(page, "admin-order-detail-legacy");
});

test("an image missing from storage becomes the placeholder, never a broken image", async () => {
  const { page } = seller;
  await page.goto(`/admin/orders/${orders.broken.id}`);
  await expect(page.getByTestId("admin-order-item-placeholder")).toBeVisible();
  expect(await thumbnailState(page, product.title)).toMatchObject({ placeholder: true });
  await shot(page, "admin-order-detail-broken-image");
});
