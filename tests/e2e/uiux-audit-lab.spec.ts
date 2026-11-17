import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { attachDiagnostics, enrollAdmin, labContextOptions, labEnabled, requireEnv, withDatabase } from "./lab-helpers";

// RARE-UIUX-AUDIT-01: evidence for the screens production cannot show without a seller login or a
// real purchase (customer orders with 1-20 items, checkout 1x-12x, support "received" state, SELLER
// Admin screens, promotion edit). Lab only (production build, disposable database, fake Asaas key,
// e-mail disabled). It MEASURES and CAPTURES: UI findings are recorded, never asserted, so the audit
// does not change behavior. Evidence: output/uiux-audit-01/lab/.
//   QA_LAB_EXTRA_SPECS=tests/e2e/uiux-audit-lab.spec.ts QA_LAB_DATABASE_URL=... npx tsx scripts/qa-staging-lab.ts --only=uiux-audit-lab --keep

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1).");
test.setTimeout(600_000);

const run = randomBytes(3).toString("hex").toLowerCase();
// UIUX_LAB_OUT=output/uiux-refine-01/lab captures the AFTER set of the refine cycle with the same spec.
const outDir = process.env.UIUX_LAB_OUT ?? path.join("output", "uiux-audit-01", "lab");
const metrics: Record<string, unknown> = { run };
const IMAGES = ["/seed-products/bone-supreme.svg", "/seed-products/bermuda-adidas.svg", "/seed-products/conjunto-nike-tech.svg", "/seed-products/calca-high-strapped.svg", "/seed-products/bolsa-bag-supreme.svg", "/brand/rare-logo.png"];
const products = Array.from({ length: 20 }, (_, index) => ({
  id: `qa_ux_p${index}_${run}`,
  variant: `qa_ux_v${index}_${run}`,
  slug: `qa-ux-peca-${index}-${run}`,
  title: `QA Peça ${String(index + 1).padStart(2, "0")} Corteiz ${run.toUpperCase()}`,
  price: 15990 + index * 1000,
  sku: `QAUX${run.toUpperCase()}-${index}`,
  image: IMAGES[index % IMAGES.length],
}));
const cheap = { id: `qa_ux_cheap_${run}`, variant: `qa_ux_cheap_v_${run}`, slug: `qa-ux-meia-barata-${run}`, title: `QA Meia Barata ${run.toUpperCase()}`, price: 3000 };
const big = { id: `qa_ux_big_${run}`, variant: `qa_ux_big_v_${run}`, slug: `qa-ux-jaqueta-${run}`, title: `QA Jaqueta 12x ${run.toUpperCase()}`, price: 60000 };
const orders = [
  { size: 1, status: "awaiting_payment", method: "card", installments: 8 },
  { size: 2, status: "paid", method: "pix", installments: null },
  { size: 5, status: "canceled", method: "pix", installments: null },
  { size: 10, status: "paid", method: "card", installments: 12 },
  { size: 20, status: "refunded", method: "card", installments: 3 },
].map((order) => ({ ...order, id: `qa_ux_o${order.size}_${run}`, number: `RARE-QA-UX${order.size}-${run.toUpperCase()}` }));

let customer: { context: BrowserContext; page: Page };
let seller: { context: BrowserContext; page: Page };

async function shot(page: Page, area: string, name: string, fullPage = true) {
  const dir = path.join(outDir, area);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage });
}

async function layout(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const read = () => page.evaluate(() => {
    // The Admin scrolls inside its own container, not the document.
    const scroller = [...document.querySelectorAll<HTMLElement>("main, main *, body > div, body > div > div")].find((el) => el.scrollHeight > el.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowY));
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      height: Math.max(document.documentElement.scrollHeight, scroller?.scrollHeight ?? 0),
      viewport: window.innerHeight,
      imagesInMain: document.querySelectorAll("main img").length,
      h1: document.querySelector("h1")?.textContent?.trim() ?? null,
    };
  });
  try {
    return await read();
  } catch {
    await page.waitForLoadState("networkidle").catch(() => undefined);
    return read();
  }
}

/** Full-length capture of an Admin screen (its own scroll container): grow the viewport, shoot, restore. */
async function adminShot(page: Page, name: string, viewport: { width: number; height: number }, contentHeight: number) {
  await page.setViewportSize({ width: viewport.width, height: Math.min(Math.max(viewport.height, contentHeight + 120), 7000) });
  await page.waitForTimeout(200);
  await shot(page, "admin", name, false);
  await page.setViewportSize(viewport);
}

async function insertProduct(db: Parameters<Parameters<typeof withDatabase>[0]>[0], product: { id: string; variant: string; slug: string; title: string; price: number; sku?: string; image?: string }) {
  await db.query(
    `INSERT INTO "Product" (id, title, slug, description, "shortDescription", brand, "priceInCents", active, "weightGrams", "lengthCm", "widthCm", "heightCm", "updatedAt")
     VALUES ($1, $2, $3, 'Fixture sintética da auditoria de UI/UX.', 'Fixture sintética.', 'Corteiz', $4, true, 300, 30, 24, 4, timezone('UTC', now()))`,
    [product.id, product.title, product.slug, product.price],
  );
  await db.query(`INSERT INTO "ProductImage" (id, "productId", url, alt, "sortOrder", "createdAt", "updatedAt") VALUES ($1, $2, $3, 'QA', 0, timezone('UTC', now()), timezone('UTC', now()))`, [`${product.id}_img`, product.id, product.image ?? IMAGES[0]]);
  await db.query(`INSERT INTO "ProductVariant" (id, "productId", size, sku, stock, active, "updatedAt") VALUES ($1, $2, 'G', $3, 5, true, timezone('UTC', now()))`, [product.variant, product.id, product.sku ?? null]);
}

test.beforeAll(async ({ browser }) => {
  await withDatabase(async (db) => {
    await db.query(`UPDATE "StoreSettings" SET "cardInstallmentsEnabled" = true, "cardInstallmentsMax" = 12, "cardInstallmentsMinInCents" = 1000 WHERE id = 'store'`);
    for (const product of [...products, { ...cheap, image: IMAGES[1] }, { ...big, image: IMAGES[2] }]) await insertProduct(db, product);
    const owner = (await db.query(`SELECT id FROM "Customer" WHERE email = $1`, [requireEnv("QA_CUSTOMER_EMAIL")])).rows[0]?.id;
    for (const order of orders) {
      const items = products.slice(0, order.size);
      const subtotal = items.reduce((sum, item) => sum + item.price, 0);
      const shipping = 2990;
      const base = subtotal + shipping;
      const rate = order.installments && order.installments > 3 ? 1400 : 0;
      const fee = Math.round((base * rate) / 10000);
      const total = base + fee;
      const per = order.installments ? Math.floor(total / order.installments) : null;
      await db.query(
        `INSERT INTO "Order" (id, "orderNumber", "customerId", "customerNameSnapshot", "customerEmailSnapshot", "subtotalInCents", "shippingInCents", "shippingMethodSnapshot",
           "totalInCents", status, "paymentProvider", "paymentMethod", "paidAt", "paymentInstallmentCount", "paymentInstallmentRateBps", "paymentInstallmentFeeInCents",
           "paymentBaseTotalInCents", "paymentInstallmentValueInCents", "paymentLastInstallmentValueInCents", "shippingCepSnapshot", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'Cliente QA', 'cliente.qa@homologacao.rare.invalid', $4, $5, 'Correios SEDEX — Prazo estimado em até 2 dias úteis', $6, $7, 'asaas', $8, $9, $10, $11, $12, $13, $14, $15, '01001000', timezone('UTC', now()), timezone('UTC', now()))`,
        [order.id, order.number, owner, subtotal, shipping, total, order.status, order.method, order.status === "paid" || order.status === "refunded" ? new Date().toISOString() : null,
          order.installments, order.installments ? rate : null, fee, order.installments ? base : null, per, per === null ? null : total - per * ((order.installments ?? 1) - 1)],
      );
      for (const [index, item] of items.entries()) {
        await db.query(
          `INSERT INTO "OrderItem" (id, "orderId", "productId", "productTitleSnapshot", "variantId", "sizeSnapshot", quantity, "unitPriceInCents", "totalInCents", "skuSnapshot", "imageUrlSnapshot", "catalogSnapshotAt", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, 'G', 1, $6, $6, $7, $8, timezone('UTC', now()), timezone('UTC', now()), timezone('UTC', now()))`,
          [`${order.id}_i${index}`, order.id, item.id, item.title, item.variant, item.price, item.sku, item.image],
        );
      }
    }
  });

  const customerContext = await browser.newContext(labContextOptions());
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
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "metrics.json"), JSON.stringify(metrics, null, 2));
  await customer?.context.close();
  await seller?.context.close();
});

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 1000 };

test("account: overview, data, addresses, orders list and order details (1/2/5/10/20 items)", async () => {
  const { page } = customer;
  for (const [label, viewport] of [["390", PHONE], ["1440", DESKTOP]] as const) {
    await page.setViewportSize(viewport);
    for (const route of ["/minha-conta", "/minha-conta/dados", "/minha-conta/enderecos", "/minha-conta/pedidos"]) {
      await page.goto(route);
      metrics[`account ${route} ${label}`] = await layout(page);
      await shot(page, "account", `${route.replaceAll("/", "_").slice(1)}-${label}`);
    }
    for (const order of orders) {
      await page.goto(`/minha-conta/pedidos/${order.id}`);
      await expect(page.getByText(order.number).first()).toBeVisible();
      metrics[`order ${order.size} items ${label}`] = await layout(page);
      await shot(page, "account", `pedido-${order.size}-itens-${order.status}-${label}`);
    }
  }
});

test("checkout: card with 1x-12x (R$ 600) on phone and desktop, then Pix", async () => {
  const { page } = customer;
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.evaluate(([productId, variantId, slug, title]) => {
    window.localStorage.setItem("rare_store_cart", JSON.stringify([{ productId, variantId, title, slug, size: "G", priceInCents: 60000, quantity: 1, maxQuantity: 5 }]));
  }, [big.id, big.variant, big.slug, big.title]);
  for (const [label, viewport] of [["390", PHONE], ["768", { width: 768, height: 1024 }], ["1440", DESKTOP]] as const) {
    await page.setViewportSize(viewport);
    await page.goto("/finalizar-compra");
    await page.waitForLoadState("networkidle");
    const card = page.locator('input[name="payment-method"][value="card"]');
    if (await card.count()) await card.check();
    // Before the refine: a visible fieldset of 12 radios. After (UIUX-CHECKOUT-001): a one-row toggle
    // that opens the same radios in a box with its own scroll.
    const toggle = page.getByTestId("card-installment-toggle");
    const compact = (await toggle.count()) > 0;
    const fieldset = page.locator("fieldset").filter({ hasText: "Parcelamento no cartão" });
    const box = compact ? await toggle.boundingBox().catch(() => null) : await fieldset.boundingBox().catch(() => null);
    const finalize = await page.getByRole("button", { name: "Finalizar compra" }).boundingBox().catch(() => null);
    metrics[`checkout card ${label}`] = {
      ...(await layout(page)),
      installmentOptions: await page.locator('input[name="card-installments"]').count(),
      installmentFieldsetHeight: box ? Math.round(box.height) : null,
      finalizeButtonTop: finalize ? Math.round(finalize.y + (await page.evaluate(() => window.scrollY))) : null,
    };
    await shot(page, "checkout", `checkout-cartao-12x-${label}`);
    if (compact) {
      await toggle.scrollIntoViewIfNeeded();
      await shot(page, "checkout", `checkout-cartao-12x-${label}-viewport`, false);
      await toggle.click();
      const panel = await fieldset.boundingBox().catch(() => null);
      metrics[`checkout card ${label} open`] = { panelHeight: panel ? Math.round(panel.height) : null };
      await shot(page, "checkout", `checkout-cartao-12x-${label}-aberto`, false);
      // A pointer pick closes the list and leaves the chosen plan (with its card total) in the toggle.
      await page.locator('input[name="card-installments"][value="8"]').check();
      metrics[`checkout card ${label} 8x`] = { toggle: (await toggle.textContent())?.trim() ?? null, listOpen: await fieldset.isVisible() };
      await shot(page, "checkout", `checkout-cartao-8x-${label}-escolhido`, false);
    } else if (await fieldset.count()) {
      await fieldset.scrollIntoViewIfNeeded();
      await shot(page, "checkout", `checkout-cartao-12x-${label}-viewport`, false);
    }
  }
  const pix = page.locator('input[name="payment-method"][value="pix"]');
  if (await pix.count()) {
    await pix.check();
    metrics["checkout pix 1440"] = await layout(page);
    await shot(page, "checkout", "checkout-pix-1440");
  }
  // Cart drawer on the phone.
  await page.setViewportSize(PHONE);
  await page.goto("/");
  const cartButton = page.getByRole("button", { name: /carrinho/i }).first();
  if (await cartButton.count()) {
    await cartButton.click();
    await page.waitForTimeout(500);
    await shot(page, "checkout", "cart-drawer-390", false);
  }
});

test("product page: a R$ 30,00 item still advertises 'até 12x' while checkout offers fewer", async () => {
  const { page } = customer;
  await page.setViewportSize(DESKTOP);
  await page.goto(`/produto/${cheap.slug}`);
  const hint = await page.locator("aside p").filter({ hasText: /sem juros|no cartão/ }).first().textContent().catch(() => null);
  await shot(page, "product", "pdp-meia-r30-1440", false);
  await page.goto("/");
  await page.evaluate(([productId, variantId, slug, title]) => {
    window.localStorage.setItem("rare_store_cart", JSON.stringify([{ productId, variantId, title, slug, size: "G", priceInCents: 3000, quantity: 1, maxQuantity: 5 }]));
  }, [cheap.id, cheap.variant, cheap.slug, cheap.title]);
  await page.goto("/finalizar-compra");
  await page.waitForLoadState("networkidle");
  const card = page.locator('input[name="payment-method"][value="card"]');
  if (await card.count()) await card.check();
  const options = await page.locator('input[name="card-installments"]').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
  metrics["pdp cheap R$30"] = { hint: hint?.trim() ?? null, checkoutOptions: options };
  await shot(page, "checkout", "checkout-meia-r30-1440");
});

test("support: the 'received' state after a valid submission (e-mail disabled in the lab)", async () => {
  const { page } = customer;
  for (const [label, viewport] of [["390", PHONE], ["1440", DESKTOP]] as const) {
    await page.setViewportSize(viewport);
    await page.goto("/suporte");
    await shot(page, "storefront", `suporte-form-logado-${label}`);
    const form = page.locator("form").filter({ has: page.locator('textarea[name="message"]') }).first();
    await form.locator('input[name="name"]').fill("Cliente QA");
    await form.locator('input[name="email"]').fill("cliente.qa@homologacao.rare.invalid");
    await form.locator('select[name="category"]').selectOption({ index: 1 });
    await form.locator('textarea[name="message"]').fill("Mensagem sintética da auditoria de UI/UX. Não responder.");
    await form.getByRole("button", { name: /Enviar mensagem/i }).click();
    await expect(page.getByText(/SUP-/).first()).toBeVisible({ timeout: 20_000 });
    metrics[`support received ${label}`] = { ...(await layout(page)), text: (await page.locator("main").innerText()).slice(0, 600) };
    await shot(page, "storefront", `suporte-recebido-${label}`);
  }
});

test("Admin SELLER: main screens on desktop, tablet and phone", async () => {
  const { page } = seller;
  const productId = products[0].id;
  const routes = ["/admin", "/admin/orders", `/admin/orders/${orders[4].id}`, `/admin/orders/${orders[0].id}`, "/admin/products", `/admin/products/${productId}/edit`, "/admin/products/new",
    "/admin/promotions", "/admin/promotions/new", "/admin/customers", "/admin/analytics", "/admin/support", "/admin/banners", "/admin/categories", "/admin/notifications", "/admin/settings"];
  for (const [label, viewport] of [["1440", DESKTOP], ["768", { width: 768, height: 1024 }], ["390", PHONE]] as const) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      const response = await page.goto(route);
      const measured = await layout(page);
      metrics[`admin ${route} ${label}`] = { status: response?.status(), url: new URL(page.url()).pathname, ...measured };
      const name = route.replace(orders[4].id, "pedido-20-itens").replace(orders[0].id, "pedido-1-item").replace(productId, "produto").replaceAll("/", "_").slice(1);
      await adminShot(page, `${name}-${label}`, viewport, measured.height);
    }
  }
});

test("Admin SELLER: promotion create → edit → save, and the error screen of a stale save", async () => {
  const { page } = seller;
  await page.setViewportSize(DESKTOP);
  await page.goto("/admin/promotions/new");
  await page.locator('input[name="name"]').fill(`QA UX ${run}`);
  await page.locator('select[name="type"]').selectOption("PERCENTAGE");
  await page.locator('input[name="value"]').fill("10");
  await page.locator('input[name="scope"][value="SELECTED_PRODUCTS"]').check();
  await page.getByPlaceholder("nome do produto").fill(products[0].title);
  await page.locator("label").filter({ hasText: products[0].title }).locator('input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: "Criar rascunho" }).click();
  await expect(page).toHaveURL(/\/admin\/promotions\/[A-Za-z0-9_-]+(\/edit)?\?/, { timeout: 30_000 });
  const promotionId = /\/admin\/promotions\/([A-Za-z0-9_-]+)/.exec(page.url())?.[1];
  await page.goto(`/admin/promotions/${promotionId}/edit`);
  await page.locator('input[name="value"]').fill("15");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.waitForLoadState("networkidle");
  metrics["promotion edit (fresh page)"] = { url: new URL(page.url()).pathname + new URL(page.url()).search, temporaryFailure: await page.getByText("Falha temporária").count() };
  await shot(page, "admin", "promocao-editada-ok-1440");

  // Same edit, but the page belongs to a previous deploy: the server answers "action not found",
  // which is what an open tab sees right after a production deploy.
  await page.goto(`/admin/promotions/${promotionId}/edit`);
  await page.route(`**/admin/promotions/${promotionId}/edit`, async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      await route.fulfill({ status: 404, headers: { "x-nextjs-action-not-found": "1", "cache-control": "no-store", "content-type": "text/plain" }, body: "Server action not found." });
      return;
    }
    await route.continue();
  });
  await page.locator('input[name="value"]').fill("20");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.waitForTimeout(2500);
  metrics["promotion edit (stale action)"] = { temporaryFailure: await page.getByText("Falha temporária").count(), text: (await page.locator("main").innerText()).slice(0, 400) };
  await shot(page, "admin", "promocao-acao-desatualizada-1440", false);
  await page.unroute(`**/admin/promotions/${promotionId}/edit`);
});
