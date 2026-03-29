import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

/**
 * MEM-78: E2E smoke tests. Loads `.env` so `webServer` inherits DATABASE_URL, NEXTAUTH_*.
 *
 * Run: `npx playwright test` (see README — seed DB first).
 */
dotenv.config({ path: ".env" });

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? baseURL
    }
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
