import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import fixtureConfig from "./playwright.config";

export default defineConfig({
  ...fixtureConfig,
  testMatch: ["states.spec.ts"],
  outputDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../output/visual-storefront/state-results"),
  projects: fixtureConfig.projects?.filter((project) => project.name === "chromium-desktop"),
});
