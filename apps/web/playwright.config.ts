import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "../../tests/e2e",
  use: {
    baseURL: baseURL
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: "NEXT_PUBLIC_REQUIRE_LIVE_API=false NEXT_PUBLIC_USE_MOCK=true pnpm dev",
    url: "http://localhost:3000",
    cwd: __dirname,
    reuseExistingServer: false
  }
});
