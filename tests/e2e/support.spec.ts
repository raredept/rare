import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { blockExternalRequests, formatAxeViolations, waitForEntranceAnimations } from "./storefront-fixtures";

// Read-only: nothing here submits a valid form, so it runs against staging without creating requests.

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

for (const width of [320, 375, 768, 1280, 1920]) {
  test(`/suporte cabe em ${width}px sem rolagem horizontal`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto("/suporte", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Suporte/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const name of ["Nome", "E-mail", "Assunto", /^Mensagem/]) await expect(page.getByLabel(name).first()).toBeVisible();
  });
}

test("/suporte não tem violações Axe", async ({ page }) => {
  await page.goto("/suporte", { waitUntil: "domcontentloaded" });
  await waitForEntranceAnimations(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, formatAxeViolations(results.violations)).toEqual([]);
});

test("/suporte por teclado: honeypot fora do Tab, limites e validação antes de enviar", async ({ page }) => {
  await page.goto("/suporte?categoria=SOLD_OUT_PRODUCT", { waitUntil: "domcontentloaded" });
  const form = page.locator("form").filter({ has: page.locator('textarea[name="message"]') });
  await expect(form.locator('input[name="website"]')).toHaveAttribute("tabindex", "-1");
  await expect(form.locator('select[name="category"]')).toHaveValue("SOLD_OUT_PRODUCT");
  await expect(form.locator('input[name="name"]')).toHaveAttribute("maxlength", "100");
  await expect(form.locator('input[name="email"]')).toHaveAttribute("maxlength", "254");
  await expect(form.locator('textarea[name="message"]')).toHaveAttribute("maxlength", "5000");

  // Walk the form with Tab only and never land on the honeypot.
  const visited: string[] = [];
  await form.locator('input[name="name"]').focus();
  for (let index = 0; index < 8; index += 1) {
    visited.push(await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name ?? document.activeElement?.tagName ?? ""));
    await page.keyboard.press("Tab");
  }
  expect(visited).not.toContain("website");
  expect(visited).toEqual(expect.arrayContaining(["name", "email", "category", "message"]));

  // An empty message is stopped by the browser: no request leaves, no protocol is shown.
  await form.locator('input[name="name"]').fill("QA Teclado");
  await form.locator('input[name="email"]').fill("qa.teclado@homologacao.rare.invalid");
  await form.locator('textarea[name="message"]').fill("");
  let posted = false;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/suporte") posted = true;
  });
  await form.getByRole("button", { name: /Enviar mensagem/i }).press("Enter");
  await expect(form.locator('textarea[name="message"]')).toBeFocused();
  expect(await form.locator('textarea[name="message"]').evaluate((element: HTMLTextAreaElement) => element.validity.valueMissing)).toBe(true);
  expect(posted).toBe(false);
  await expect(page.getByText(/Protocolo:/)).toHaveCount(0);
});
