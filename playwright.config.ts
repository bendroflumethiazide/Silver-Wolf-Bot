import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "off", viewport: { width: 1366, height: 860 } },
  // Runs the same standalone server the desktop app ships (built by `pnpm desktop:prepare`).
  webServer: { command: `node dist-desktop/server/server.js`, env: { PORT: String(PORT), HOSTNAME: "127.0.0.1", ASTRAL_LOCAL_ONLY: "1" }, url: `http://127.0.0.1:${PORT}`, reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: "desktop", use: { browserName: "chromium" }, testIgnore: /mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" }, testMatch: /mobile/ },
  ],
});
