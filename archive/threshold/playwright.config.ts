import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the seeded in-browser demo, so they need no backend.
 * Locally, point PW_CHROMIUM_PATH at an existing Chromium to skip the download.
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
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 }, timezoneId: "America/New_York" } },
    { name: "mobile", use: { ...devices["Pixel 7"], timezoneId: "Asia/Tokyo" } },
  ],
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
  },
});
