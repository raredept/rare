import { expect, test } from "@playwright/test";
import { blockExternalRequests, captureUnexpectedBrowserIssues, publicAuditRoutes } from "./storefront-fixtures";

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

for (const route of publicAuditRoutes) {
  test(`${route.name} não emite erro ou warning inesperado`, async ({ page }) => {
    const issues = captureUnexpectedBrowserIssues(page);
    const response = await page.goto(route.path, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    expect(issues).toEqual([]);
  });
}
