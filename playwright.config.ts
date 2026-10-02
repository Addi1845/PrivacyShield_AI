import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120000,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { viewport: { width: 1440, height: 1050 } },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4317",
    reuseExistingServer: true,
  },
  outputDir: "test-results",
});
