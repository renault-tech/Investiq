import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "fs";

/**
 * E2E config. Uses the Chromium binary pre-installed in some sandboxed dev
 * environments instead of Playwright's own download, when present — that
 * path is environment-specific (a pinned revision may not match whatever
 * @playwright/test expects) and doesn't exist in CI or on a plain
 * checkout, where `playwright install chromium` sets up the browser in the
 * normal default location instead.
 *
 * Assumes the API (uvicorn, port 8000) + Postgres + Redis are already
 * running — same "real infra, not mocks" convention as the backend's own
 * integration test suite. This config only manages the Next.js dev server.
 */
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    // Must match the API's FRONTEND_URL exactly (CORS checks Origin as an
    // exact string) — "localhost" and "127.0.0.1" are different origins
    // even though they resolve to the same host.
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
