import { defineConfig } from "vitest/config";

export default defineConfig({
  // Unit QA must never load workspace credentials from .env files.
  envDir: false,
  test: {
    environment: "node",
    // Both extensions: .test.tsx files were silently excluded and never ran.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
