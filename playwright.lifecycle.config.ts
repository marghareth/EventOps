// playwright.lifecycle.config.ts
// Browser lifecycle test (B1-14): `npm run test:e2e:lifecycle`. Runs the app with dev-only demo
// sign-in (D-024) against a separate TEST database, which is reset before every run. Local only;
// see docs/TESTING.md.
import { defineConfig, devices } from "@playwright/test";

// Checked in global setup, so tools that only read this file (knip) don't fail without it.
const database = process.env.E2E_DATABASE_URL;
const port = Number(process.env.E2E_PORT ?? 3100);
// Optional: a locally installed Chromium, for machines where Playwright can't download its own.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e/lifecycle",
  globalSetup: "./e2e/lifecycle/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: database
    ? {
        command: `npx next dev -p ${port}`,
        url: `http://localhost:${port}/login`,
        reuseExistingServer: false,
        timeout: 180_000,
        env: {
          DEV_DEMO_AUTH: "true",
          DATABASE_URL: database,
          DIRECT_URL: database,
        },
      }
    : undefined,
});