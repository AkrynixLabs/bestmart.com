import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.E2E_PORT ?? 3100)
const GLOBAL = /(settings|payouts)\.spec\.ts/

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: GLOBAL },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: GLOBAL },
    // Tests that change platform-wide state run last, one project after another, so no other test
    // sees a changed fee (settings) or an emptied balance (payouts pay every eligible seller).
    { name: "settings", use: { ...devices["Desktop Chrome"] }, testMatch: /settings\.spec\.ts/, dependencies: ["desktop", "mobile"] },
    { name: "payouts", use: { ...devices["Desktop Chrome"] }, testMatch: /payouts\.spec\.ts/, dependencies: ["settings"] },
  ],
  // Runs against a production build (`npm run build` first), which is what ships.
  webServer: {
    command: `npx next start -p ${port}`,
    env: { E2E_TEST_MODE: "1" },
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
