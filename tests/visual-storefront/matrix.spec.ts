import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { installFixtureWaits } from "./fixture-waits";
import { waitForEntranceAnimations } from "../e2e/storefront-fixtures";

installFixtureWaits();

const screenshotRoot = path.resolve("output/visual-storefront/screenshots");
const widths = [360, 390, 430, 768, 1024, 1280, 1440, 1600];
const routes = [
  { name: "home", path: "/" },
  { name: "catalog", path: "/categoria/tudo" },
  { name: "product", path: "/produto/qa-camiseta" },
  { name: "login", path: "/entrar" },
  { name: "cart-paused", path: "/finalizar-compra" },
];

for (const width of widths) {
  test.describe(`Fixture matrix ${width}px`, () => {
    test.use({ viewport: { width, height: width < 768 ? 900 : 1000 } });
    for (const route of routes) {
      test(`${route.name}: screenshot, overflow, Axe and skip-link`, async ({ page }, testInfo) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(route.path);
        await page.evaluate(() => document.fonts.ready);
        await waitForEntranceAnimations(page);
        await expect(page.locator("main")).toHaveCount(1);
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("main")).not.toContainText("Preview interrompido");
        expect(await page.evaluate(() => window.__RARE_FIXTURE_QA__)).toEqual({ backend: "DENIED", catalog: "IN_MEMORY", origin: "LOOPBACK_ONLY" });
        // Approved production baseline (raredept.com.br, main 4ea73f5): neutral-50 canvas, black header, weight-900 display type.
        await expect(page.locator("#store-main")).toHaveCSS("background-color", "oklch(0.985 0 0)");
        await expect(page.locator("header").first()).toHaveCSS("background-color", "rgb(0, 0, 0)");
        if (route.name === "home") {
          await expect(page.locator(".store-home-hero")).toHaveCSS("border-radius", "8px");
          await expect(page.getByRole("heading", { name: "Destaques do mês", exact: true })).toHaveCSS("font-weight", "900");
          await expect(page.locator(".store-product-card :is(h2, h3)").first()).toHaveCSS("font-weight", "900");
        } else {
          await expect(page.locator("h1")).toHaveCSS("font-weight", "900");
        }
        if (route.name === "login") await expect(page.locator('main input[name="email"]')).toHaveCSS("font-size", "16px");

        await mkdir(screenshotRoot, { recursive: true });
        const screenshot = path.join(screenshotRoot, `${width}-${route.name}.png`);
        await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
        await testInfo.attach(`${width}-${route.name}`, { path: screenshot, contentType: "image/png" });
        await page.screenshot({ path: path.join(screenshotRoot, `${width}-${route.name}-viewport.png`), fullPage: false, animations: "disabled" });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

        const axe = await new AxeBuilder({ page }).analyze();
        expect(axe.violations.map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.map((node) => node.target) }))).toEqual([]);
        await page.keyboard.press("Tab");
        const skip = page.getByRole("link", { name: "Pular para o conteúdo", exact: true });
        await expect(skip).toBeFocused();
        await expect(skip).toBeVisible();
        await page.keyboard.press("Enter");
        await expect(page.locator("#store-main")).toBeFocused();
      });
    }
  });
}

test("reduced motion disables autoplay controls and active infinite animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const controls = page.locator("[data-motion-control]");
  expect(await controls.count()).toBeGreaterThan(0);
  for (const control of await controls.all()) await expect(control).toBeDisabled();
  await waitForEntranceAnimations(page);
  expect(await page.evaluate(() => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations === Infinity && animation.playState === "running").length)).toBe(0);
});

for (const width of [390, 1440]) test(`enabled-commerce ${width}px fixture changes cart state only in browser memory/storage`, async ({ page }) => {
  await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const backendRequests: string[] = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) backendRequests.push(request.method()); });
  await page.goto("/produto/qa-camiseta?qaCommerce=enabled");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "ADICIONAR AO CARRINHO", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Sua seleção" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("QA Fixture — Camiseta");
  await drawer.getByRole("button", { name: "Aumentar quantidade", exact: true }).click();
  await expect(drawer.getByLabel("Quantidade 2", { exact: true })).toHaveText("2");
  await drawer.getByRole("button", { name: "Diminuir quantidade", exact: true }).click();
  await expect(drawer.getByLabel("Quantidade 1", { exact: true })).toHaveText("1");
  expect(backendRequests).toEqual([]);
  await mkdir(screenshotRoot, { recursive: true });
  await page.screenshot({ path: path.join(screenshotRoot, `${width}-cart-enabled-in-memory.png`), fullPage: true, animations: "disabled" });
  await page.screenshot({ path: path.join(screenshotRoot, `${width}-cart-enabled-in-memory-viewport.png`), fullPage: false, animations: "disabled" });
  const axe = await new AxeBuilder({ page }).include("[data-cart-drawer-root]").analyze();
  expect(axe.violations.map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }))).toEqual([]);
  await page.getByRole("button", { name: "Fechar carrinho", exact: true }).click();
  await expect(drawer).toBeHidden();
});

test("network guard refuses API mutations and noncanonical loopback before transport", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });
  await page.goto("/");
  const results = await page.evaluate(async () => (await Promise.allSettled([
    fetch("/api/checkout", { method: "POST", body: "fixture-only" }),
    fetch("http://127.0.0.1:4174/fixture-never-transmitted"),
  ])).map((result) => result.status));
  expect(results).toEqual(["rejected", "rejected"]);
  expect(apiRequests).toEqual([]);
});
