import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../../tests/e2e",
  use: {
    baseURL: "http://localhost:3000"
  },
  webServer: {
    command: "NEXT_PUBLIC_REQUIRE_LIVE_API=false NEXT_PUBLIC_USE_MOCK=true pnpm dev",
    url: "http://localhost:3000",
    cwd: __dirname,
    reuseExistingServer: false
  }
});
