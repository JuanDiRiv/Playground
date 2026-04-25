import { defineConfig, devices } from "@playwright/test";

/**
 * Minimal Playwright config — runs against `next dev` on a configurable
 * port. Tests live under `e2e/`. Run with:
 *   npx playwright test
 *
 * Note: the dev server requires Firebase and OpenAI environment variables.
 * The smoke tests under `e2e/smoke.spec.ts` only hit unauthenticated pages
 * (`/`, `/login`) so they work even without those env vars set, as long as
 * the build succeeds.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
