import { expect, test } from "@playwright/test";
import { blockExternalRequests, captureUnexpectedBrowserIssues, publicAuditRoutes, withoutStagingGateNoise } from "./storefront-fixtures";

test.beforeEach(async ({ page }) => {
  await blockExternalRequests(page);
});

for (const route of publicAuditRoutes) {
  test(`${route.name} não emite erro ou warning inesperado`, async ({ page }) => {
    const issues = captureUnexpectedBrowserIssues(page);

    // "load", not "networkidle". The App Router prefetches the category links in
    // the header, and on a link-dense page those `?_rsc=` requests stay open, so
    // the page never reaches network idle and the test times out instead of
    // reporting anything about the console. Reproduced identically on the
    // catalog route before and after this branch.
    const response = await page.goto(route.path, { waitUntil: "load" });
    expect(response?.status()).toBe(200);

    // Give late scripts a moment to log, since "load" returns earlier than the
    // old wait did.
    await page.waitForTimeout(1_000);

    expect(withoutStagingGateNoise(issues)).toEqual([]);
  });
}
