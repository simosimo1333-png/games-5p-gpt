import { describe, expect, it } from "vitest";

import { GAME_HEIGHT, GAME_WIDTH, isSupportedViewport } from "./game";

describe("game configuration", () => {
  it("uses a 16:9 logical resolution", () => {
    expect(GAME_WIDTH / GAME_HEIGHT).toBeCloseTo(16 / 9);
  });

  it.each([
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1280, height: 720 },
  ])("accepts a supported viewport: $width x $height", ({ width, height }) => {
    expect(isSupportedViewport(width, height)).toBe(true);
  });

  it.each([
    { width: 0, height: 720 },
    { width: 1280, height: 0 },
    { width: Number.NaN, height: 720 },
  ])("rejects an unsupported viewport: $width x $height", ({ width, height }) => {
    expect(isSupportedViewport(width, height)).toBe(false);
  });
});
