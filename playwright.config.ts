import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the seeded in-browser demo, so they need no backend.
 * Locally, point PW_CHROMIUM_PATH at an existing Chromium to skip the download.
 * The business runs on Portland time; the two projects use other timezones to prove it.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", testIgnore: /onchain/, use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 }, timezoneId: "America/New_York" } },
    { name: "mobile", testIgnore: /onchain/, use: { ...devices["Pixel 7"], timezoneId: "Asia/Tokyo" } },
    // Paying the deposit in USDC: a build with an escrow configured (.env.chain-e2e), against a simulated chain.
    { name: "onchain", testMatch: /onchain/, use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 }, timezoneId: "America/Los_Angeles", baseURL: "http://127.0.0.1:4174" } },
  ],
  webServer: [
    {
      command: "npm run build && npx vite preview --port 4173 --host 127.0.0.1",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npx vite build --mode chain-e2e --outDir dist-chain && npx vite preview --mode chain-e2e --outDir dist-chain --port 4174 --host 127.0.0.1",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
