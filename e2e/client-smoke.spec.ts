import { expect, test } from "@playwright/test";

test("新しいクライアントがモバイル画面で起動する", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("放課後ダッシュ！");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("main#app")).toHaveAttribute("aria-label", "放課後ダッシュ！");
  await page.close();
});

test("縦向きでは横向き案内を表示する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#orientation-hint")).toBeVisible();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#orientation-hint")).toBeHidden();
  await page.close();
});
