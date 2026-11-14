import { defineConfig } from "@playwright/test";
import fixtureConfig from "./playwright.config";

export default defineConfig({
  ...fixtureConfig,
  testMatch: ["matrix.spec.ts"],
  projects: fixtureConfig.projects?.filter((project) => project.name === "chromium-desktop"),
});
