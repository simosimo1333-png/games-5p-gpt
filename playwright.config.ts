import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
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
      name: "ios-safari",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "node ../../node_modules/vite/bin/vite.js preview --host 127.0.0.1",
    cwd: "apps/client",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    stderr: "ignore",
    stdout: "ignore",
    timeout: 120_000,
  },
});
