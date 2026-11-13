import { randomBytes } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { attachDiagnostics, labContextOptions, labEnabled, rawFetch, requireEnv, withDatabase } from "./lab-helpers";
import { waitForEntranceAnimations } from "./storefront-fixtures";

// Payment provider as the shopper sees it, and the Asaas webhook endpoint, on a production build
// (scripts/qa-staging-lab.ts). QA_EXPECT_PROVIDER says which PAYMENT_PROVIDER the server runs with:
// asaas or disabled (unset, Stripe and unknown values fail closed).

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1).");

const expected = (process.env.QA_EXPECT_PROVIDER ?? "asaas") as "asaas" | "stripe" | "disabled";
let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext(labContextOptions());
  page = await context.newPage();
  attachDiagnostics(page);
  await page.goto("/entrar");
  await page.locator('form input[name="email"]').first().fill(requireEnv("QA_CUSTOMER_EMAIL"));
  await page.locator('form input[name="password"]').first().fill(requireEnv("QA_CUSTOMER_PASSWORD"));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
});

test.afterAll(async () => {
  await context?.close();
});

/** The storefront streams behind a loading boundary; wait for the final content before reading it. */
async function settledMain() {
  await expect(page.locator("main").first()).not.toContainText("Carregando conteúdo", { timeout: 15_000 });
  await waitForEntranceAnimations(page);
}

async function openCheckoutWithCart() {
  await page.goto("/");
  await page.evaluate(([productId, variantId, slug, title]) => {
    window.localStorage.setItem("rare_store_cart", JSON.stringify([{ productId, variantId, title, slug, size: "M", priceInCents: 20000, quantity: 1, maxQuantity: 1 }]));
  }, [requireEnv("QA_BF_PRODUCT_ID"), requireEnv("QA_BF_VARIANT_ID"), requireEnv("QA_BF_PRODUCT_SLUG"), requireEnv("QA_BF_PRODUCT_TITLE")]);
  await page.goto("/finalizar-compra");
  await waitForEntranceAnimations(page);
  // The order summary (picker, payment window, button, gateway note). The deadline banner above it
  // belongs to an earlier order and names that order's own gateway.
  const summary = page.locator("aside, section, div").filter({ has: page.getByRole("button", { name: "Finalizar compra" }) }).last();
  return { summary, text: await summary.innerText() };
}

test(`checkout names only the gateway that charges (${expected})`, async () => {
  const { text } = await openCheckoutWithCart();
  const button = page.getByRole("button", { name: "Finalizar compra" });
  if (expected === "asaas") {
    expect(text).toContain("Asaas");
    expect(text).toContain("30 minutos");
    expect(text).not.toMatch(/Stripe|Mercado Pago|15 minutos|débito/);

  } else {
    expect(text).toContain("Pagamentos temporariamente indisponíveis");
    expect(text).not.toMatch(/Asaas|Stripe|Mercado Pago|minutos para finalizar/);
    await expect(button).toBeDisabled();
  }
});

test("Pix and order pages of an Asaas order never mention another gateway", async () => {
  test.skip(expected === "disabled", "Same pages; covered by the asaas and stripe runs.");
  await page.goto(`/pedido/pix/${requireEnv("QA_PIX_ORDER_ID")}`);
  await settledMain();
  const pix = await page.locator("main").innerText();
  expect(pix).toContain("Pague com Pix");
  expect(pix).not.toMatch(/Mercado Pago|Stripe/);
  await expect(page.getByRole("link", { name: "Abrir o Pix na página do Asaas" })).toBeVisible();

  await page.goto(`/minha-conta/pedidos/${requireEnv("QA_PAID_ORDER_ID")}`);
  await settledMain();
  // Read the order itself, not the loading skeleton (which would pass the check vacuously).
  await expect(page.getByRole("heading", { level: 1, name: /^Pedido / })).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(/Mercado Pago|Stripe/);
});

test("checkout API: an unknown PAYMENT_PROVIDER starts no payment and reserves nothing", async ({ playwright }) => {
  test.skip(expected !== "disabled", "Only when the server runs with an unknown provider.");
  const cookie = (await context.cookies()).map((item) => `${item.name}=${item.value}`).join("; ");
  const before = await withDatabase(async (db) => (await db.query(`SELECT COUNT(*)::int AS n FROM "Order"`)).rows[0].n);
  const response = await rawFetch(playwright.request, "/api/checkout", {
    method: "POST",
    cookie,
    headers: { "content-type": "application/json", origin: new URL(requireEnv("PLAYWRIGHT_BASE_URL")).origin },
    data: JSON.stringify({ items: [{ productId: requireEnv("QA_BF_PRODUCT_ID"), variantId: requireEnv("QA_BF_VARIANT_ID"), quantity: 1 }], paymentMethod: "pix" }),
  });
  expect(response.status).toBe(503);
  expect(response.text).toContain("Pagamentos temporariamente indisponíveis");
  const after = await withDatabase(async (db) => (await db.query(`SELECT COUNT(*)::int AS n FROM "Order"`)).rows[0].n);
  expect(after).toBe(before);
  // The public health route hides variable names by design; it must still report the
  // configuration as broken (the lab's only other error is STORAGE_DRIVER=local).
  const health = JSON.parse((await rawFetch(playwright.request, "/api/health")).text) as { configuration: { ok: boolean; errors: unknown[] } };
  expect(health.configuration.ok).toBe(false);
  expect(health.configuration.errors.length).toBeGreaterThanOrEqual(2);
});

test("Asaas webhook: token, persistence, duplicates, malformed and oversized bodies", async ({ playwright }) => {
  test.skip(expected !== "asaas", "The webhook runs with the Asaas configuration.");
  const token = requireEnv("QA_ASAAS_WEBHOOK_TOKEN");
  const eventId = `evt_qa_${randomBytes(6).toString("hex")}`;
  // A non-payment event: stored and acknowledged, never sent to the Asaas API (no network call).
  const body = JSON.stringify({ id: eventId, event: "ACCOUNT_STATUS_UPDATED", dateCreated: "2026-11-06 10:00:00" });
  const post = (headers: Record<string, string>, data: string = body) => rawFetch(playwright.request, "/api/asaas/webhook", { method: "POST", headers: { "content-type": "application/json", ...headers }, data });

  const missing = await post({});
  expect(missing.status).toBe(401);
  const wrong = await post({ "asaas-access-token": `${token.slice(0, -1)}x` });
  expect(wrong.status).toBe(401);
  const apiKeyAsToken = await post({ "asaas-access-token": requireEnv("QA_ASAAS_API_KEY_SHAPE") });
  expect(apiKeyAsToken.status).toBe(401);

  const first = await post({ "asaas-access-token": token });
  expect(first.status).toBe(200);
  expect(JSON.parse(first.text)).toMatchObject({ received: true, duplicate: false });
  const again = await post({ "asaas-access-token": token });
  expect(again.status).toBe(200);
  expect(JSON.parse(again.text)).toMatchObject({ received: true, duplicate: true });

  const malformed = await post({ "asaas-access-token": token }, "{not json");
  expect(malformed.status).toBe(200);
  expect(JSON.parse(malformed.text)).toMatchObject({ ignored: true });
  const oversized = await post({ "asaas-access-token": token }, JSON.stringify({ id: "evt_big", event: "PAYMENT_CREATED", pad: "x".repeat(70 * 1024) }));
  expect(oversized.status).toBe(413);
  const multibyteEventId = `evt_qa_utf8_${randomBytes(6).toString("hex")}`;
  const multibyte = await post({ "asaas-access-token": token }, JSON.stringify({ id: multibyteEventId, event: "ACCOUNT_STATUS_UPDATED", pad: "é".repeat(35 * 1024) }));
  expect(multibyte.status).toBe(413);
  const fakePayment = await post({ "asaas-access-token": token }, JSON.stringify({ id: `evt_qa_bad_${randomBytes(4).toString("hex")}`, event: "PAYMENT_RECEIVED", payment: { id: "../../v3/customers" } }));
  expect(fakePayment.status).toBe(200);

  await withDatabase(async (db) => {
    const rejected = await db.query(`SELECT id FROM "AsaasWebhookEvent" WHERE id = $1`, [multibyteEventId]);
    expect(rejected.rowCount).toBe(0);
    const rows = await db.query(`SELECT status, "paymentId" FROM "AsaasWebhookEvent" WHERE id = $1`, [eventId]);
    expect(rows.rows).toEqual([{ status: "ignored", paymentId: null }]);
    const bad = await db.query(`SELECT "paymentId" FROM "AsaasWebhookEvent" WHERE id LIKE 'evt_qa_bad_%'`);
    expect(bad.rows.every((row) => row.paymentId === null)).toBe(true); // a path-like id is never used
  });
});
