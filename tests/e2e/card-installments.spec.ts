import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { attachDiagnostics, enrollAdmin, expectNoHorizontalOverflow, labContextOptions, labEnabled, requireEnv, withDatabase } from "./lab-helpers";

// RARE-CARD-INSTALLMENTS-02: card installments (1x-12x) together with the SKU / photo snapshot, on
// phone and desktop: product page copy, checkout options, the customer's order and the Admin order
// (SELLER_ADMIN). Runs only in the local lab (production build, disposable database, fake Asaas key:
// nothing here reaches Asaas). Evidence: output/card-installments-02/.

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1).");
test.setTimeout(300_000);

const run = randomBytes(3).toString("hex").toLowerCase();
const evidenceDir = path.join("output", "card-installments-02");
const IMAGE = "/brand/rare-logo.png";
const product = { id: `qa_inst_p_${run}`, variant: `qa_inst_v_${run}`, slug: `qa-camiseta-parcelada-${run}`, title: `QA Camiseta Parcelada ${run.toUpperCase()}` };
const SKU = `QA${run.toUpperCase()}-CRTZ-BLK-G`;
const order = { id: `qa_inst_order_${run}`, number: `RARE-QA-12X-${run.toUpperCase()}` };
const PHONE = { width: 375, height: 812 };

let customer: { context: BrowserContext; page: Page };
let seller: { context: BrowserContext; page: Page };

async function shot(page: Page, name: string) {
  mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: true });
}

test.beforeAll(async ({ browser }) => {
  // Installments ON for the lab store (the server also runs with CARD_INSTALLMENTS_ENABLED=true).
  await withDatabase(async (db) => {
    await db.query(`UPDATE "StoreSettings" SET "cardInstallmentsEnabled" = true, "cardInstallmentsMax" = 12, "cardInstallmentsMinInCents" = 1000 WHERE id = 'store'`);
    await db.query(
      `INSERT INTO "Product" (id, title, slug, description, "shortDescription", "priceInCents", active, "weightGrams", "lengthCm", "widthCm", "heightCm", "updatedAt")
       VALUES ($1, $2, $3, 'Fixture sintética do parcelamento.', 'Fixture sintética.', 60000, true, 400, 30, 24, 4, timezone('UTC', now()))`,
      [product.id, product.title, product.slug],
    );
    await db.query(`INSERT INTO "ProductImage" (id, "productId", url, alt, "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, $3, 'QA', 0, timezone('UTC', now()), timezone('UTC', now()))`, [`qa_inst_img_${run}`, product.id, IMAGE]);
    await db.query(`INSERT INTO "ProductVariant" (id, "productId", size, sku, stock, active, "updatedAt") VALUES ($1, $2, 'G', $3, 5, true, timezone('UTC', now()))`, [product.variant, product.id, SKU]);
    const owner = (await db.query(`SELECT id FROM "Customer" WHERE email = $1`, [requireEnv("QA_CUSTOMER_EMAIL")])).rows[0]?.id;
    // A paid 12x order as the checkout writes it: R$ 600,00 - RARE10 R$ 60,00 + frete R$ 20,00 = R$ 560,00;
    // 12x at 18% = + R$ 100,80 -> R$ 660,80 (11 x R$ 55,06 + R$ 55,14).
    await db.query(
      `INSERT INTO "Order" (id, "orderNumber", "customerId", "customerNameSnapshot", "customerEmailSnapshot", "subtotalInCents", "couponCode", "discountInCents", "shippingInCents",
         "shippingMethodSnapshot", "totalInCents", status, "paymentProvider", "paymentMethod", "paidAt",
         "paymentInstallmentCount", "paymentInstallmentRateBps", "paymentInstallmentFeeInCents", "paymentBaseTotalInCents", "paymentInstallmentValueInCents", "paymentLastInstallmentValueInCents",
         "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'Cliente QA', 'cliente.qa@homologacao.rare.invalid', 60000, 'RARE10', 6000, 2000, 'Correios PAC', 66080, 'paid', 'asaas', 'card', timezone('UTC', now()),
         12, 1800, 10080, 56000, 5506, 5514, timezone('UTC', now()), timezone('UTC', now()))`,
      [order.id, order.number, owner],
    );
    await db.query(
      `INSERT INTO "OrderItem" (id, "orderId", "productId", "productTitleSnapshot", "variantId", "sizeSnapshot", quantity, "unitPriceInCents", "totalInCents", "skuSnapshot", "imageUrlSnapshot", "catalogSnapshotAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'G', 1, 60000, 60000, $6, $7, timezone('UTC', now()), timezone('UTC', now()), timezone('UTC', now()))`,
      [`qa_inst_item_${run}`, order.id, product.id, product.title, product.variant, SKU, IMAGE],
    );
  });

  const customerContext = await browser.newContext({ ...labContextOptions(), viewport: PHONE });
  const customerPage = await customerContext.newPage();
  attachDiagnostics(customerPage);
  await customerPage.goto("/entrar");
  await customerPage.locator('form input[name="email"]').first().fill(requireEnv("QA_CUSTOMER_EMAIL"));
  await customerPage.locator('form input[name="password"]').first().fill(requireEnv("QA_CUSTOMER_PASSWORD"));
  await customerPage.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(customerPage).not.toHaveURL(/\/entrar/);
  customer = { context: customerContext, page: customerPage };

  const sellerContext = await browser.newContext(labContextOptions());
  const sellerPage = await sellerContext.newPage();
  attachDiagnostics(sellerPage);
  await enrollAdmin(sellerPage, requireEnv("QA_MFA_H_LOGIN"), requireEnv("QA_MFA_H_PASSWORD"), new Set());
  seller = { context: sellerContext, page: sellerPage };
});

test.afterAll(async () => {
  await customer?.context.close();
  await seller?.context.close();
});

test("phone: product page says 'até 3x sem juros · até 12x no cartão', with no surcharged amount", async () => {
  const { page } = customer;
  await page.goto(`/produto/${product.slug}`);
  await expect(page.getByText("ou em até 3x sem juros · ou até 12x no cartão")).toBeVisible();
  await expectNoHorizontalOverflow(page, "PDP 375");
  await shot(page, "pdp-mobile-375");
});

test("phone: checkout lists 1x-12x, interest-free up to 3x and the final card total from 4x", async () => {
  const { page } = customer;
  await page.goto("/");
  // Seed only after the CartProvider hydrated: an earlier write is overwritten by its first persist.
  await page.waitForLoadState("networkidle");
  await page.evaluate(([productId, variantId, slug, title]) => {
    window.localStorage.setItem("rare_store_cart", JSON.stringify([{ productId, variantId, title, slug, size: "G", priceInCents: 60000, quantity: 1, maxQuantity: 5 }]));
  }, [product.id, product.variant, product.slug, product.title]);
  await page.goto("/finalizar-compra");
  await page.waitForLoadState("networkidle");
  const card = page.locator('input[name="payment-method"][value="card"]');
  if (await card.count()) await card.check();
  const options = page.locator('input[name="card-installments"]');
  await expect(options).toHaveCount(12);
  // UIUX-CHECKOUT-001: the plans live in a compact picker; open it to read and choose.
  await expect(page.getByTestId("card-installment-toggle")).toContainText(/1x de R\$\s600,00 sem juros/);
  await page.getByTestId("card-installment-toggle").click();
  await expect(page.getByText(/^3x de R\$\s200,00 sem juros$/)).toBeVisible();
  await expect(page.getByText(/^12x de .* com acréscimo · Total no cartão R\$\s708,00$/)).toBeVisible();
  await expect(page.locator('input[name="card-installments"][value="13"]')).toHaveCount(0);
  await page.locator('input[name="card-installments"][value="12"]').check();
  await expect(page.getByText("Acréscimo do parcelamento").first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "checkout 375");
  await shot(page, "checkout-12x-mobile-375");
});

test("phone: the customer's 12x order shows the plan, the surcharge and the total", async () => {
  const { page } = customer;
  await page.goto(`/minha-conta/pedidos/${order.id}`);
  await expect(page.getByText(/12x de R\$\s55,06 \(última R\$\s55,14\) com acréscimo/).first()).toBeVisible();
  await expect(page.getByText("Acréscimo do parcelamento").first()).toBeVisible();
  await expect(page.getByText(/R\$\s660,80/).first()).toBeVisible();
  await expectNoHorizontalOverflow(page, "customer order 375");
  await shot(page, "customer-order-12x-mobile-375");
});

test("Admin (SELLER): one order screen with photo, SKU, size, qty, price and the 12x financial lines", async () => {
  const { page } = seller;
  for (const viewport of [{ width: 1440, height: 1000, name: "desktop" }, { width: 375, height: 812, name: "mobile-375" }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/admin/orders/${order.id}`);
    const item = page.getByTestId("admin-order-item").filter({ hasText: product.title });
    await expect(item).toBeVisible();
    await expect(item.getByTestId("admin-order-item-sku")).toHaveText(`SKU: ${SKU}`);
    await expect(item.getByTestId("admin-order-item-thumbnail").locator("img")).toBeVisible();
    await expect(item).toContainText("Tamanho G · Qtd 1");
    await expect(page.getByText("Cupom RARE10").first()).toBeVisible();
    await expect(page.getByText("Acréscimo do parcelamento (18%)").first()).toBeVisible();
    await expect(page.getByText(/12x de R\$\s55,06 \(última R\$\s55,14\) com acréscimo/).first()).toBeVisible();
    await expect(page.getByText(/R\$\s660,80/).first()).toBeVisible();
    await expectNoHorizontalOverflow(page, `admin order ${viewport.name}`);
    await shot(page, `admin-order-12x-${viewport.name}`);
  }
});
