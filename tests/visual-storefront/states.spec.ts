import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { installFixtureWaits } from "./fixture-waits";

installFixtureWaits();

const screenshotRoot = path.resolve("output/visual-storefront/screenshots");
const localFront = "/seed-products/conjunto-nike-tech.svg";
const localBack = "/seed-products/calca-high-strapped.svg";

async function essentialControl(control: Locator, viewportWidth: number) {
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
}

for (const width of [390, 1440]) {
  test(`media recovery ${width}px: broken first image, healthy second and remount`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Local fixture resource only: intentional 404, never a provider request.
    await page.route(`**${localFront}`, (route) => route.fulfill({ status: 404, contentType: "text/plain", body: "Fixture QA missing image" }));
    await page.goto("/produto/qa-camiseta");
    const next = page.getByRole("button", { name: "Próxima imagem", exact: true });
    const frame = next.locator("..");
    await expect(frame.getByText("Mídia indisponível", { exact: true })).toBeVisible();
    await essentialControl(next, width);
    await next.click();
    const second = frame.locator(`img[src="${localBack}"]`);
    await expect(second).toBeVisible();
    await expect.poll(() => second.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Imagem anterior", exact: true }).click();
    await expect(frame.getByText("Mídia indisponível", { exact: true })).toBeVisible();
    await next.click();
    await expect(second).toBeVisible();
    await expect.poll(() => second.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await essentialControl(page.getByRole("button", { name: "Ampliar imagem do produto", exact: true }), width);
  });

  test(`paused commerce ${width}px: seeded local cart never enables checkout`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const apiRequests: string[] = [];
    page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.method()); });
    await page.addInitScript(() => {
      localStorage.setItem("rare_store_cart", JSON.stringify([{ productId: "qa-product-1", variantId: "qa-variant-1-m", title: "QA Fixture — Camiseta", slug: "qa-camiseta", size: "M", image: "/seed-products/conjunto-nike-tech.svg", priceInCents: 20000, quantity: 1, maxQuantity: 3 }]));
    });
    await page.goto("/produto/qa-camiseta");
    await page.getByRole("button", { name: "M", exact: true }).click();
    await expect(page.getByRole("button", { name: "Compras temporariamente pausadas", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "G, esgotado", exact: true })).toBeDisabled();
    await page.locator("[data-cart-trigger]:visible").click();
    const drawer = page.getByRole("dialog", { name: "Sua seleção", exact: true });
    await expect(drawer).toContainText("QA Fixture — Camiseta");
    const checkout = drawer.getByRole("button", { name: "Compras temporariamente pausadas", exact: true });
    await expect(checkout).toBeDisabled();
    await essentialControl(checkout, width);
    await essentialControl(drawer.getByRole("button", { name: "Aumentar quantidade", exact: true }), width);
    await drawer.getByRole("button", { name: "Aumentar quantidade", exact: true }).click();
    await expect(drawer.getByLabel("Quantidade 2", { exact: true })).toHaveText("2");
    expect(apiRequests).toEqual([]);
    await mkdir(screenshotRoot, { recursive: true });
    await page.screenshot({ path: path.join(screenshotRoot, `${width}-cart-paused-seeded-viewport.png`), animations: "disabled" });
  });
}

test("sold-out, fully reserved and inactive-variant fixtures keep purchase disabled", async ({ page }) => {
  for (const slug of ["qa-esgotado", "qa-reservado", "qa-variante-inativa"]) {
    await page.goto(`/produto/${slug}`);
    await expect(page.getByRole("button", { name: "ESGOTADO", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "ADICIONAR AO CARRINHO", exact: true })).toHaveCount(0);
  }
});

for (const width of [1024, 1280]) test(`direct cart component ${width}px: fixture-only seeded presentation`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const apiRequests: string[] = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.method()); });
  await page.addInitScript(() => {
    localStorage.setItem("rare_store_cart", JSON.stringify([{ productId: "qa-product-1", variantId: "qa-variant-1-m", title: "QA Fixture — Camiseta", slug: "qa-camiseta", size: "M", image: "/seed-products/conjunto-nike-tech.svg", priceInCents: 20000, quantity: 1, maxQuantity: 3 }]));
  });
  // Direct presentation component only, not the guarded real checkout route.
  await page.goto("/qa/cart?qaCommerce=enabled");
  await expect(page.locator("h1")).toHaveText("Finalizar compra");
  await expect(page.locator("main")).toContainText("QA Fixture — Camiseta");
  await expect(page.getByRole("button", { name: "Finalizar compra", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await mkdir(screenshotRoot, { recursive: true });
  await page.screenshot({ path: path.join(screenshotRoot, `${width}-cart-component-fixture.png`), fullPage: true, animations: "disabled" });
  await page.screenshot({ path: path.join(screenshotRoot, `${width}-cart-component-fixture-viewport.png`), animations: "disabled" });
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }))).toEqual([]);
  expect(apiRequests).toEqual([]);
});

test("ten-banner fixture at 360px keeps arrows and final indicator focus unclipped", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?qaBanners=10");
  const group = page.getByRole("group", { name: "Selecionar slide", exact: true });
  const indicators = group.getByRole("button", { name: /^Ir para slide/ });
  await expect(indicators).toHaveCount(10);
  const previous = page.getByRole("button", { name: "Slide anterior", exact: true });
  const next = page.getByRole("button", { name: "Próximo slide", exact: true });
  await essentialControl(previous, 360);
  await essentialControl(next, 360);
  const groupBox = (await group.boundingBox())!;
  const previousBox = (await previous.boundingBox())!;
  expect(groupBox.x + groupBox.width).toBeLessThanOrEqual(previousBox.x);
  await indicators.first().focus();
  for (let index = 1; index < 10; index++) await page.keyboard.press("Tab");
  const last = indicators.last();
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport();
  const lastBox = (await last.boundingBox())!;
  expect(lastBox.x).toBeGreaterThanOrEqual(groupBox.x - 1);
  expect(lastBox.x + lastBox.width).toBeLessThanOrEqual(groupBox.x + groupBox.width + 1);
  expect(await last.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await mkdir(screenshotRoot, { recursive: true });
  await page.screenshot({ path: path.join(screenshotRoot, "360-home-ten-banners-final-focus-viewport.png"), animations: "disabled" });
});
