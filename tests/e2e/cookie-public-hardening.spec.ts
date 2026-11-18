import { mkdirSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { attachDiagnostics, expectNoHorizontalOverflow, labContextOptions, labEnabled } from "./lab-helpers";
import { formatAxeViolations } from "./storefront-fixtures";

// RARE-COOKIE-PUBLIC-HARDENING-01: the cookie policy, the banner and the preferences panel against
// the production build. No technical cookie/storage name, nothing about the Admin or MFA, no
// "Ver detalhes técnicos"; the consent behaviour itself is unchanged (prelaunch-consent-analytics
// keeps proving it). Screenshots go to output/cookie-public-hardening-01/ (outside Git).

test.describe.configure({ mode: "serial" });
test.skip(!labEnabled, "Lab only: run through scripts/qa-staging-lab.ts (QA_LAB_ENABLED=1).");
test.setTimeout(240_000);

const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1440];
const TECHNICAL = /rare_admin_session|rare_admin_mfa_pending|rare_customer_session|rare_cookie_consent|rare_store_cart|rare_store_shipping_selection|rare:home-motion-paused:v2|rare_analytics_visitor|rare_analytics_session/;
const STAFF = /administrativ|segundo fator|\bMFA\b|equipe da loja|cookies internos/i;
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const shots = path.join(process.cwd(), "output", "cookie-public-hardening-01");
mkdirSync(shots, { recursive: true });

async function expectNoPublicTechnicalText(page: Page, scope: string, label: string) {
  const text = await page.locator(scope).first().innerText();
  expect(text, `${label}: technical name`).not.toMatch(TECHNICAL);
  expect(text, `${label}: rare_ prefix`).not.toMatch(/rare[_:]/);
  expect(text, `${label}: Admin/MFA wording`).not.toMatch(STAFF);
}

test("policy page: plain-language cards, no technical names, no overflow from 320 to 1440 px, axe clean", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions());
  const page = await context.newPage();
  attachDiagnostics(page);
  await page.goto("/politica-de-cookies");
  const html = await page.content();
  expect(html).not.toMatch(TECHNICAL);
  await expectNoPublicTechnicalText(page, "main", "policy");
  for (const label of ["Preferências de privacidade", "Sessão da conta", "Carrinho", "Entrega", "Preferências visuais", "Identificador do navegador", "Identificador da visita"]) {
    await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
  }
  await expect(page.locator("main table")).toHaveCount(0);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    // The page streams: measure the real content, never the loading skeleton.
    await expect(page.getByRole("heading", { name: "Identificador da visita", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sua escolha", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page, `policy at ${width}px`);
    await page.screenshot({ path: path.join(shots, `policy-${width}.png`), fullPage: true });
  }
  const results = await new AxeBuilder({ page }).include("main").withTags(WCAG).analyze();
  expect(results.violations, formatAxeViolations(results.violations)).toEqual([]);
  await context.close();
});

test("banner and panel: no technical details, keyboard reachable, choice persists after reload, fits 320–1440 px", async ({ browser }) => {
  const context = await browser.newContext(labContextOptions({ cookieConsent: "undecided" }));
  const page = await context.newPage();
  attachDiagnostics(page);
  await page.goto("/");
  const banner = page.locator("[data-cookie-banner]");
  await expect(banner).toBeVisible();
  await expectNoPublicTechnicalText(page, "[data-cookie-banner]", "banner");
  const bannerAxe = await new AxeBuilder({ page }).include("[data-cookie-banner]").withTags(WCAG).analyze();
  expect(bannerAxe.violations, formatAxeViolations(bannerAxe.violations)).toEqual([]);

  // Keyboard: "Configurar" opens the panel; the focus ring is visible.
  const configure = banner.getByRole("button", { name: "Configurar", exact: true });
  await configure.focus();
  const ring = await configure.evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.boxShadow} ${style.outlineStyle}`;
  });
  expect(ring === "none none", "focus ring on Configurar").toBe(false);
  await page.keyboard.press("Enter");
  const panel = page.locator("dialog[data-cookie-preferences]");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Ver detalhes técnicos")).toHaveCount(0);
  await expect(panel.locator("details")).toHaveCount(0);
  await expectNoPublicTechnicalText(page, "dialog[data-cookie-preferences]", "panel");
  await expect(panel.getByText("Sempre ativos", { exact: true })).toBeVisible();
  const toggle = panel.getByRole("switch");
  await expect(toggle).not.toBeChecked();
  const panelAxe = await new AxeBuilder({ page }).include("dialog[data-cookie-preferences]").withTags(WCAG).analyze();
  expect(panelAxe.violations, formatAxeViolations(panelAxe.violations)).toEqual([]);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoHorizontalOverflow(page, `panel at ${width}px`);
    const box = await panel.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= width + 1, `panel inside the viewport at ${width}px`).toBe(true);
    for (const name of ["Salvar preferências", "Aceitar todos", "Recusar não essenciais"]) {
      const button = panel.getByRole("button", { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      const b = await button.boundingBox();
      expect(b && b.height >= 44 && b.x >= 0 && b.x + b.width <= width + 1, `${name} at ${width}px`).toBe(true);
    }
    await panel.evaluate((element) => element.scrollTo(0, 0));
    await page.screenshot({ path: path.join(shots, `panel-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // Change, save, reload: the choice persists and the panel shows it.
  await toggle.check();
  await panel.getByRole("button", { name: "Salvar preferências" }).click();
  await expect(panel).toBeHidden();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(page.locator("[data-cookie-banner]")).toHaveCount(0);
  const footerButton = page.getByRole("button", { name: "Preferências de Cookies" });
  await footerButton.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("switch")).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await context.close();
});
