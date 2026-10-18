import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  outputDir: "output/playwright/results",
  timeout: 30_000,
});
