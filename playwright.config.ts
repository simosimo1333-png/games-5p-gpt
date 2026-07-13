import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "iphone-17-pro-safari",
      use: {
        ...devices["iPhone 15 Pro"],
        deviceScaleFactor: 3,
        viewport: { width: 402, height: 874 },
      },
    },
    {
      name: "iphone-17-pro-max-safari",
      use: {
        ...devices["iPhone 15 Pro"],
        deviceScaleFactor: 3,
        viewport: { width: 440, height: 956 },
      },
    },
  ],
  webServer: [
    {
      command: "node node_modules/tsx/dist/cli.mjs apps/server/src/index.ts",
      port: 8787,
      reuseExistingServer: !process.env.CI,
      stderr: "ignore",
      stdout: "ignore",
      timeout: 120_000,
    },
    {
      command: "node ../../node_modules/vite/bin/vite.js preview --host 127.0.0.1",
      cwd: "apps/client",
      port: 4173,
      reuseExistingServer: !process.env.CI,
      stderr: "ignore",
      stdout: "ignore",
      timeout: 120_000,
    },
  ],
});
