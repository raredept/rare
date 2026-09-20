import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseURL || "http://127.0.0.1:3100";
const managesServer = !externalBaseURL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [["list"], ["html", { outputFolder: "output/playwright/report", open: "never" }]],
  outputDir: "output/playwright/results",
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL,
    // The homologation storefront sits behind a Basic gate. Supplying the
    // credentials here lets the existing public specs run against staging
    // unchanged, instead of each one re-declaring them.
    ...(process.env.STAGING_ACCESS_USERNAME
      ? {
          httpCredentials: {
            username: process.env.STAGING_ACCESS_USERNAME,
            password: process.env.STAGING_ACCESS_PASSWORD ?? "",
          },
        }
      : {}),
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: "light",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: managesServer
    ? {
        command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          APP_URL: "https://raredept.com.br",
          CHECKOUT_ENABLED: "false",
          ...(process.env.QA_DATABASE_URL ? { DATABASE_URL: process.env.QA_DATABASE_URL } : {}),
          EMAIL_DRIVER: "disabled",
          NEXT_PUBLIC_APP_URL: "https://raredept.com.br",
          NEXT_TELEMETRY_DISABLED: "1",
          RATE_LIMIT_DRIVER: "memory",
          SHIPPING_ENABLED: "false",
          ...(process.env.QA_STORAGE_LOCAL_DIR
            ? {
                STORAGE_DRIVER: "local",
                STORAGE_LOCAL_DIR: process.env.QA_STORAGE_LOCAL_DIR,
                STORAGE_PUBLIC_BASE_URL: "/uploads",
              }
            : {}),
        },
      }
    : undefined,
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 900 } },
    },
  ],
});
