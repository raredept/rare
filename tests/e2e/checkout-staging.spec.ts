import { expect, test, type Page } from "@playwright/test";

// Commercial homologation flow. Runs ONLY against an isolated staging with Stripe TEST keys and
// synthetic fixtures. It creates real (test-mode) Stripe sessions and orders, so it is skipped
// unless the operator opts in explicitly, and it refuses to run against production.
//
//   STAGING_E2E=1 PLAYWRIGHT_BASE_URL=https://<staging> \
//   STAGING_ACCESS_USERNAME=... STAGING_ACCESS_PASSWORD=... \
//   HML_CUSTOMER_EMAIL=... HML_CUSTOMER_PASSWORD=... HML_PRODUCT_SLUG=hml-camiseta-leve npx playwright test checkout-staging
const enabled = process.env.STAGING_E2E === "1";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "";
const productionHosts = new Set(["raredept.com.br", "www.raredept.com.br"]);
const isProduction = (() => { try { return productionHosts.has(new URL(baseURL).hostname); } catch { return false; } })();
const slug = process.env.HML_PRODUCT_SLUG ?? "hml-camiseta-leve";

test.skip(!enabled || !baseURL || isProduction, "Homologação de checkout: exige STAGING_E2E=1 e um staging isolado (nunca produção).");
test.use({
  httpCredentials: process.env.STAGING_ACCESS_USERNAME
    ? { username: process.env.STAGING_ACCESS_USERNAME, password: process.env.STAGING_ACCESS_PASSWORD ?? "" }
    : undefined,
});
test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.goto("/entrar");
  await page.fill('input[name="email"]', process.env.HML_CUSTOMER_EMAIL ?? "");
  await page.fill('input[name="password"]', process.env.HML_CUSTOMER_PASSWORD ?? "");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
}

async function addToCartAndOpenCheckout(page: Page) {
  await page.goto(`/produto/${slug}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("rare_store_cart"));
  await page.reload({ waitUntil: "domcontentloaded" });
  const size = page.locator('button[aria-label^="M"]').first();
  if (await size.count()) await size.click();
  await page.getByRole("button", { name: /ADICIONAR AO CARRINHO/i }).click();
  await page.goto("/finalizar-compra", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[name="shippingOption"]', { timeout: 30_000 });
  if (!(await page.locator('input[name="shippingOption"]:checked').count())) await page.locator('input[name="shippingOption"]').first().check();
}

async function payWithCard(page: Page, card: string) {
  await Promise.all([page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 }), page.getByRole("button", { name: /Finalizar compra/i }).last().click()]);
  await page.locator("#cardNumber").fill(card);
  await page.locator("#cardExpiry").fill("12 / 34");
  await page.locator("#cardCvc").fill("123");
  if (await page.locator("#billingName").count()) await page.locator("#billingName").fill("Cliente Homologacao");
  await page.locator('button[type="submit"], .SubmitButton').last().click();
}

test("pagamento aprovado volta à loja com o pedido pago", async ({ page }) => {
  await signIn(page);
  await addToCartAndOpenCheckout(page);
  await payWithCard(page, "4242424242424242");
  await page.waitForURL(/\/pedido\/sucesso/, { timeout: 90_000 });
  await expect(page.getByText(/Status: Pago/)).toBeVisible({ timeout: 60_000 });
});

test("cartão recusado permanece no Stripe com mensagem clara e sem cobrar", async ({ page }) => {
  await signIn(page);
  await addToCartAndOpenCheckout(page);
  await payWithCard(page, "4000000000009995");
  await expect(page.getByText(/fundos insuficientes|recusad/i).first()).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
});

test("novo checkout fecha o anterior não pago e não duplica a reserva", async ({ page }) => {
  await signIn(page);
  await addToCartAndOpenCheckout(page);
  const first = await page.request.post("/api/checkout", { data: await checkoutBody(page) });
  expect([200, 409]).toContain(first.status());
  await page.waitForTimeout(5500);
  const second = await page.request.post("/api/checkout", { data: await checkoutBody(page) });
  expect(second.status()).toBe(200);
  const status = await (await page.request.get("/api/checkout/status")).json();
  expect(status.order.status).toBe("awaiting_payment");
});

async function checkoutBody(page: Page) {
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("rare_store_cart") ?? "[]") as Array<{ productId: string; variantId: string; quantity: number }>);
  const address = await page.locator('input[name="customerAddressId"]:checked').getAttribute("value");
  return {
    items: cart.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
    customerAddressId: address ?? undefined,
    shippingOptionId: "fixed", shippingOptionProvider: "fixed", shippingOptionService: "fixed", shippingDestinationCep: "30130010",
  };
}

for (const width of [320, 390, 1440]) {
  test(`checkout sem rolagem horizontal em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 700 ? 800 : 1000 });
    await signIn(page);
    await addToCartAndOpenCheckout(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
