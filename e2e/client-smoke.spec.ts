import { expect, test } from "@playwright/test";

test("新しいクライアントがモバイル画面で起動する", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("放課後ダッシュ！");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("main#app")).toHaveAttribute("aria-label", "放課後ダッシュ！");
  await expect(page.locator(".how-to-play")).toContainText("落ちた仲間");
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

test("canvas stays inside the latest iPhone viewport", async ({ page }) => {
  await page.goto("/");

  const viewport = page.viewportSize();
  const canvas = await page.locator("canvas").boundingBox();

  expect(viewport).not.toBeNull();
  expect(canvas).not.toBeNull();

  if (viewport && canvas) {
    expect(canvas.x).toBeGreaterThanOrEqual(0);
    expect(canvas.y).toBeGreaterThanOrEqual(0);
    expect(canvas.x + canvas.width).toBeLessThanOrEqual(viewport.width);
    expect(canvas.y + canvas.height).toBeLessThanOrEqual(viewport.height);
  }
});

test("two devices can create, join, and start the same room", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const guestContext = await browser.newContext({
    viewport: { width: 956, height: 440 },
    isMobile: true,
    hasTouch: true,
  });
  const guest = await guestContext.newPage();
  await page.setViewportSize({ width: 874, height: 402 });
  await page.goto("/");
  await guest.goto("/");

  await page.locator("#player-name").fill("Host");
  await page.locator("#create-room").click();
  await expect(page.locator("#current-room")).not.toHaveText("");
  const roomCode = await page.locator("#current-room").textContent();
  expect(roomCode).toMatch(/^[A-Z0-9]{5}$/);

  await guest.locator("#player-name").fill("Guest");
  await guest.locator("#room-code").fill(roomCode ?? "");
  await guest.locator("#join-room").click();
  await expect(page.locator("#player-list li")).toHaveCount(2);
  await expect(guest.locator("#player-list li")).toHaveCount(2);

  await guest.locator('input[name="player-role"][value="jumper"]').check();
  await expect(page.locator("#player-list")).toContainText("ジャンパー");

  await page.locator("#ready-button").click();
  await guest.locator("#ready-button").click();
  await expect(page.locator("#player-list li").filter({ hasText: "準備OK" })).toHaveCount(2);
  await page.locator("#start-button").click();
  await expect(page.locator("#lobby-panel")).toBeHidden({ timeout: 6_000 });
  await expect(guest.locator("#lobby-panel")).toBeHidden({ timeout: 6_000 });

  await guestContext.close();
});
