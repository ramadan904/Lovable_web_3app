import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // Unit tests only; Playwright owns e2e/.
  test: { include: ["src/**/*.test.ts"] },
});
