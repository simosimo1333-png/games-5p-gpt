import { describe, expect, it } from "vitest";

import { SnapshotInterpolator } from "./snapshot-interpolator";

const player = (x: number) => ({
  id: "p1",
  x,
  y: 500,
  velocityX: 100,
  velocityY: 0,
  lastProcessedInput: 1,
  finished: false,
  downed: false,
});

describe("snapshot interpolation", () => {
  it("smooths jitter even when snapshots arrive out of order", () => {
    const buffer = new SnapshotInterpolator();
    buffer.push({ serverTime: 300, players: [player(300)] });
    buffer.push({ serverTime: 100, players: [player(100)] });
    expect(buffer.sample("p1", 200)?.x).toBe(200);
  });

  it("interpolates across a dropped snapshot", () => {
    const buffer = new SnapshotInterpolator();
    buffer.push({ serverTime: 100, players: [player(100)] });
    buffer.push({ serverTime: 300, players: [player(300)] });
    expect(buffer.sample("p1", 150)?.x).toBe(150);
  });

  it("holds the latest state when the next packet is late", () => {
    const buffer = new SnapshotInterpolator();
    buffer.push({ serverTime: 100, players: [player(100)] });
    expect(buffer.sample("p1", 400)?.x).toBe(100);
  });
});
