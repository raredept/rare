import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { blockExternalRequests, formatAxeViolations, productPath, publicAuditRoutes } from "./storefront-fixtures";

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

for (const route of publicAuditRoutes) {
  test(`${route.name} não tem violações Axe`, async ({ page }) => {
    const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, formatAxeViolations(results.violations)).toEqual([]);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
  });
}

test("menu mobile aberto permanece acessível", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile", "O menu mobile só existe no viewport mobile.");
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const dialog = page.getByRole("dialog", { name: "RARE" });
  await expect(dialog).toBeVisible();
  const results = await new AxeBuilder({ page }).include("#store-mobile-menu").analyze();
  expect(results.violations, formatAxeViolations(results.violations)).toEqual([]);
});

test("carrinho aberto permanece acessível", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-cart-trigger]:visible").click();
  const dialog = page.getByRole("dialog", { name: "Sua seleção" });
  await expect(dialog).toBeVisible();
  const results = await new AxeBuilder({ page }).include("[data-cart-drawer-root]").analyze();
  expect(results.violations, formatAxeViolations(results.violations)).toEqual([]);
});

test("lightbox do produto permanece acessível", async ({ page }) => {
  await page.goto(productPath);
  const trigger = page.getByRole("button", { name: "Ampliar imagem do produto" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: /Imagem ampliada de/i });
  await expect(dialog).toBeVisible();
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(results.violations, formatAxeViolations(results.violations)).toEqual([]);
});
