import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { waitForEntranceAnimations } from "./storefront-fixtures";

test("reconciled Admin fits all requested widths and keeps drawer focus contained", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "The desktop context exercises all eight widths explicitly.");
  test.skip(!process.env.QA_DATABASE_URL || !process.env.QA_CURRENT_ADMIN_LOGIN || !process.env.QA_CURRENT_ADMIN_PASSWORD,
    "Requires disposable PostgreSQL runner.");
  test.setTimeout(300_000);
  await page.goto("/admin/login");
  await page.getByLabel("Login ou e-mail").fill(process.env.QA_CURRENT_ADMIN_LOGIN!);
  await page.getByLabel("Senha").fill(process.env.QA_CURRENT_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin(?:\?|$)/);

  for (const width of [320, 375, 390, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/admin", "/admin/analytics", "/admin/orders", "/admin/products", "/admin/customers", "/admin/categories", "/admin/banners", "/admin/notifications", "/admin/readiness", "/admin/settings", "/admin/products/new"]) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} at ${width}px`).toBe(200);
      await expect(page.locator("h1")).toBeVisible();
      await waitForEntranceAnimations(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${route} at ${width}px`).toBeLessThanOrEqual(0);
      if (["/admin/orders", "/admin/products", "/admin/customers"].includes(route)) {
        // overflow-hidden can hide clipped columns without overflowing the document.
        const list = page.locator("main section").first();
        expect(await list.evaluate(node => node.scrollWidth - node.clientWidth), `${route} internal clipping at ${width}px`).toBeLessThanOrEqual(1);
      }
      if (route === "/admin") await page.screenshot({ path: testInfo.outputPath(`admin-${width}.png`), fullPage: true });
    }
    if (width >= 1024) continue;
    const trigger = page.getByRole("button", { name: "Abrir menu administrativo" });
    for (let run = 1; run <= 3; run++) {
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "RARE ADMIN" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Fechar menu administrativo" })).toBeFocused();
    const links = dialog.locator("a[href],button:not([disabled])");
    await links.last().focus();
    await page.keyboard.press("Tab");
    await expect(links.first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(links.last()).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    const axe = await new AxeBuilder({ page }).include("#admin-mobile-navigation").analyze();
    expect(axe.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`drawer-${width}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await trigger.click();
    await dialog.getByRole("link", { name: "Analytics", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/analytics$/);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Sair", exact: true })).toBeVisible();
    }
    if (width === 390) {
      await trigger.click();
      await page.setViewportSize({ width: 1024, height: 1000 });
      await expect(page.getByRole("dialog")).toBeHidden();
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    }
  }
});
