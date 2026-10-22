import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const python = path.join(
  root,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const edgeInstalled =
  process.platform === "win32" &&
  existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3002",
    channel: process.env.E2E_BROWSER ?? (edgeInstalled ? "msedge" : "chromium"),
    viewport: { width: 1440, height: 1000 },
    locale: "da-DK",
    timezoneId: "Europe/Copenhagen",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `"${python}" scripts/e2e_server.py`,
      cwd: root,
      url: "http://127.0.0.1:5003/api/health",
      timeout: 30_000,
      reuseExistingServer: false,
    },
    {
      command:
        "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3002",
      cwd: __dirname,
      env: { API_URL: "http://127.0.0.1:5003", NEXT_DIST_DIR: ".next-e2e" },
      url: "http://127.0.0.1:3002/perioder",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
