import { expect, test } from "@playwright/test";

test("新しいクライアントがモバイル画面で起動する", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("放課後ダッシュ！");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("main#app")).toHaveAttribute("aria-label", "放課後ダッシュ！");
});
