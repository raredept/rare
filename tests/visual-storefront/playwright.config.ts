import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const baseURL = "http://127.0.0.1:4173";
const outputRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../output/visual-storefront");
// Existing fixtures inspect these names independently of Playwright's use.baseURL.
process.env.PLAYWRIGHT_BASE_URL = baseURL;
process.env.PLAYWRIGHT_PRODUCT_SLUG = "qa-camiseta";
process.env.PLAYWRIGHT_MULTI_IMAGE_SLUG = "qa-camiseta";
delete process.env.STAGING_ACCESS_USERNAME;
delete process.env.STAGING_ACCESS_PASSWORD;
delete process.env.STAGING_E2E;

export default defineConfig({
  testDir: ".",
  testMatch: ["accessibility.spec.ts", "keyboard.spec.ts", "links.spec.ts", "product-gallery.spec.ts", "console.spec.ts"],
  fullyParallel: false, workers: 1, retries: 0,
  reporter: [["list"], ["html", { outputFolder: path.join(outputRoot, "report"), open: "never" }]],
  outputDir: path.join(outputRoot, "results"),
  expect: { timeout: 8_000 },
  use: { baseURL, locale: "pt-BR", timezoneId: "America/Sao_Paulo", colorScheme: "light", serviceWorkers: "block", screenshot: "only-on-failure", trace: "retain-on-failure", video: "off" },
  // Intentionally no webServer: start ONLY the reviewed Vite harness separately.
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 900 } } },
  ],
});
