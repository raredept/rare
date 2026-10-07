import { test, type Page } from "@playwright/test";

// Existing specs assume SSR HTML is ready after navigation. This Vite-only
// preview assembles async fixture page functions in the browser instead.
export function installFixtureWaits() {
  test.beforeEach(async ({ page, context }) => {
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== "http://127.0.0.1:4173") {
        await route.abort("blockedbyclient"); return;
      }
      await route.continue();
    });
    const originalGoto = page.goto.bind(page);
    page.goto = async (...args: Parameters<Page["goto"]>) => {
      const response = await originalGoto(...args);
      if (response && new URL(response.url()).origin === "http://127.0.0.1:4173" && (response.headers()["content-type"] ?? "").includes("text/html")) {
        await page.locator('[data-fixture-qa="true"][data-fixture-ready="true"]').waitFor({ state: "visible", timeout: 30_000 });
      }
      return response;
    };
  });
}
