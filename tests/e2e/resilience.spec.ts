import { expect, test } from "@playwright/test";
import { blockExternalRequests, productPath } from "./storefront-fixtures";

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

test("conteúdo permanece estável com imagem lenta", async ({ page }) => {
  await page.route(/\/(?:uploads\/products\/|_next\/image\?)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto(productPath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const image = page.locator("img.store-product-image").first();
  await expect(image).toBeVisible();
  const box = await image.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.height ?? 0).toBeGreaterThan(0);
});

test("página já carregada continua legível ao ficar offline", async ({ page, context }) => {
  await page.goto("/sobre", { waitUntil: "domcontentloaded" });
  await context.setOffline(true);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await context.setOffline(false);
});

test("produto removido retorna estado 404 útil", async ({ page }) => {
  const response = await page.goto("/produto/produto-que-nao-existe", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Produto não encontrado" })).toBeVisible();
  await expect(page.getByRole("link", { name: /catálogo/i }).first()).toBeVisible();
});

test("sessão inválida não expõe conta e redireciona para login", async ({ page, context }) => {
  await context.addCookies([{ name: "rare_customer_session", value: "sessao-invalida", url: "http://127.0.0.1:3100" }]);
  await page.goto("/minha-conta");
  await expect(page).toHaveURL(/\/entrar/);
  await expect(page.getByRole("heading", { level: 1, name: "Entrar" })).toBeVisible();
});

test("reduced motion desativa animações perceptíveis", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.locator(".store-home-section").first().evaluate((element) => getComputedStyle(element).animationDuration);
  expect(["0s", "0.001s"]).toContain(duration);
});

test("modo de alto contraste mantém ações disponíveis", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "forced-colors é validado no Chromium desktop.");
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Ver catálogo completo/i }).first()).toBeVisible();
});
