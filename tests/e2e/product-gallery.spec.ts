import { expect, test, type Page } from "@playwright/test";
import { blockExternalRequests, captureUnexpectedBrowserIssues } from "./storefront-fixtures";

/**
 * Product gallery with several images: thumbnails, previous/next, lightbox,
 * keyboard, touch and a slow image.
 *
 * Needs a product with at least two images, so it is opt-in:
 *
 *   PLAYWRIGHT_MULTI_IMAGE_SLUG=qa-multi-imagem-temporario \
 *   PLAYWRIGHT_BASE_URL=https://<staging> npx playwright test product-gallery
 *
 * The single-image catalog in staging could never exercise any of this.
 */

const slug = process.env.PLAYWRIGHT_MULTI_IMAGE_SLUG;

test.skip(!slug, "Requer PLAYWRIGHT_MULTI_IMAGE_SLUG apontando para um produto com 2+ imagens.");

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

async function mainImageSrc(page: Page) {
  // The main photo is the first product image rendered in the gallery frame.
  return page.locator("img.store-product-image").first().getAttribute("src");
}

async function openProduct(page: Page) {
  const response = await page.goto(`/produto/${slug}`, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("renders one thumbnail per image and marks the selected one", async ({ page }) => {
  await openProduct(page);
  const thumbnails = page.getByRole("button", { name: /^Selecionar (imagem|vídeo|mídia) \d+$/i });
  const count = await thumbnails.count();
  expect(count).toBeGreaterThanOrEqual(2);

  await expect(thumbnails.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(thumbnails.nth(1)).toHaveAttribute("aria-pressed", "false");
});

test("thumbnail, next and previous all change the main image", async ({ page }) => {
  await openProduct(page);
  const first = await mainImageSrc(page);

  await page.getByRole("button", { name: /^Selecionar (imagem|mídia) 2$/i }).click();
  await expect.poll(() => mainImageSrc(page)).not.toBe(first);
  const second = await mainImageSrc(page);

  await page.getByRole("button", { name: "Imagem anterior" }).click();
  await expect.poll(() => mainImageSrc(page)).toBe(first);

  await page.getByRole("button", { name: "Próxima imagem" }).click();
  await expect.poll(() => mainImageSrc(page)).toBe(second);
});

test("previous wraps from the first image to the last", async ({ page }) => {
  await openProduct(page);
  const thumbnails = page.getByRole("button", { name: /^Selecionar (imagem|mídia) \d+$/i });
  const last = (await thumbnails.count()) - 1;

  await page.getByRole("button", { name: "Imagem anterior" }).click();
  await expect(thumbnails.nth(last)).toHaveAttribute("aria-pressed", "true");
});

test("lightbox opens, navigates by keyboard, traps focus and closes with Escape", async ({ page }) => {
  await openProduct(page);
  const trigger = page.getByRole("button", { name: "Ampliar imagem do produto" });
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const zoomed = () => dialog.locator("img").first().getAttribute("src");
  const before = await zoomed();

  await page.keyboard.press("ArrowRight");
  await expect.poll(zoomed).not.toBe(before);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(zoomed).toBe(before);

  // Focus stays inside the dialog while tabbing.
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("lightbox buttons navigate with a pointer", async ({ page }) => {
  await openProduct(page);
  await page.getByRole("button", { name: "Ampliar imagem do produto" }).click();
  const dialog = page.getByRole("dialog");
  const zoomed = () => dialog.locator("img").first().getAttribute("src");
  const before = await zoomed();

  await dialog.getByRole("button", { name: "Próxima imagem ampliada" }).click();
  await expect.poll(zoomed).not.toBe(before);
  await dialog.getByRole("button", { name: "Imagem ampliada anterior" }).click();
  await expect.poll(zoomed).toBe(before);
  await dialog.getByRole("button", { name: "Fechar visualização ampliada" }).click();
  await expect(dialog).toBeHidden();
});

test("touch: tapping the arrows changes the image on a phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile", "Só no projeto mobile (touch).");
  await openProduct(page);
  const first = await mainImageSrc(page);
  await page.getByRole("button", { name: "Próxima imagem" }).tap();
  await expect.poll(() => mainImageSrc(page)).not.toBe(first);
});

test("the gallery keeps its layout while a later image loads slowly", async ({ page }) => {
  // Delay every product image after the first request by two seconds.
  let served = 0;
  await page.route(/\/uploads\/products\//, async (route) => {
    served += 1;
    if (served > 1) await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.continue();
  });

  await openProduct(page);
  const frame = page.locator("img.store-product-image").first();
  const before = await frame.boundingBox();

  await page.getByRole("button", { name: "Próxima imagem" }).click();
  const during = await frame.boundingBox();
  expect(during?.height ?? 0).toBeGreaterThan(0);
  // No collapse or jump while the next image is in flight.
  expect(Math.abs((during?.height ?? 0) - (before?.height ?? 0))).toBeLessThan(2);
});

test("renders without console errors or failed requests", async ({ page }) => {
  const issues = captureUnexpectedBrowserIssues(page);
  await page.goto(`/produto/${slug}`, { waitUntil: "load" });
  await page.waitForTimeout(1_000);
  expect(issues).toEqual([]);
});
