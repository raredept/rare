import { expect, test, type Locator } from "@playwright/test";
import { blockExternalRequests, isMobileProject, productPath } from "./storefront-fixtures";

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

async function expectVisibleFocus(locator: Locator) {
  await expect(locator).toBeFocused();
  const visible = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== "none" || style.boxShadow !== "none";
  });
  expect(visible).toBe(true);
}

test("Tab alcança a navegação do Header com foco visível", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  await expect(focused).toHaveCount(1);
  expect(await focused.evaluate((element) => Boolean(element.closest("header")))).toBe(true);
});

test("menu mobile prende o foco, fecha com Escape e devolve ao acionador", async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo), "Cenário exclusivo do menu mobile.");
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Abrir menu" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const close = page.getByRole("button", { name: "Fechar menu" }).last();
  await expectVisibleFocus(close);
  await page.keyboard.press("Shift+Tab");
  expect(await page.locator(":focus").evaluate((element) => Boolean(element.closest("#store-mobile-menu")))).toBe(true);
  await page.keyboard.press("Escape");
  await expectVisibleFocus(trigger);
});

test("login e cadastro têm ordem de foco lógica", async ({ page }) => {
  await page.goto("/entrar");
  const email = page.getByRole("textbox", { name: "E-mail" });
  await email.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator('input[name="password"]')).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /Mostrar senha/i })).toBeFocused();

  await page.goto("/cadastro");
  await page.getByRole("textbox", { name: "Nome" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "E-mail" })).toBeFocused();
});

test("tamanho, quantidade, galeria e lightbox operam por teclado", async ({ page }) => {
  await page.goto(productPath);
  const size = page.locator("fieldset button:not([disabled])").first();
  await size.focus();
  await page.keyboard.press("Enter");
  await expect(size).toHaveAttribute("aria-pressed", "true");

  const increase = page.getByRole("button", { name: "Aumentar quantidade" });
  if (await increase.isEnabled()) {
    await increase.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[role="group"][aria-label="Controle de quantidade"] [aria-live="polite"]')).not.toHaveText("1");
  }

  const zoomTrigger = page.getByRole("button", { name: "Ampliar imagem do produto" });
  await zoomTrigger.focus();
  await page.keyboard.press("Enter");
  const close = page.getByRole("button", { name: "Fechar visualização ampliada" });
  await expectVisibleFocus(close);
  await page.keyboard.press("Shift+Tab");
  expect(await page.locator(":focus").evaluate((element) => element.closest('[role="dialog"]') !== null)).toBe(true);
  await page.keyboard.press("Escape");
  await expectVisibleFocus(zoomTrigger);
});

test("carrinho e Footer são navegáveis por teclado", async ({ page }, testInfo) => {
  await page.goto("/");
  const cart = page.locator("[data-cart-trigger]:visible");
  await cart.focus();
  await page.keyboard.press("Enter");
  const close = page.getByRole("button", { name: "Fechar carrinho" });
  await expectVisibleFocus(close);
  await page.keyboard.press("Escape");
  await expectVisibleFocus(cart);

  const footerHome = page.locator("footer").getByRole("link", { name: "RARE", exact: true });
  await footerHome.focus();
  await expectVisibleFocus(footerHome);

  if (testInfo.project.name === "webkit") {
    const about = page.locator("footer").getByRole("link", { name: "Sobre a RARE" });
    await about.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/sobre$/);
    return;
  }

  await page.keyboard.press("Tab");
  expect(await page.locator(":focus").evaluate((element) => Boolean(element.closest("footer")))).toBe(true);
});
