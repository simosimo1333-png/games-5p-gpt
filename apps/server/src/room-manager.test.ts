import { describe, expect, it } from "vitest";

import { RoomManager } from "./room-manager";

describe("multi-room scale", () => {
  it("updates fifty six-player rooms within the aggregate budget", () => {
    const manager = new RoomManager();
    for (let roomIndex = 0; roomIndex < 50; roomIndex += 1) {
      const room = manager.create(`p${roomIndex}-1`, "Player 1", 0);
      for (let playerIndex = 2; playerIndex <= 6; playerIndex += 1)
        room.join(`p${roomIndex}-${playerIndex}`, `Player ${playerIndex}`, 0);
      for (const player of room.players.values()) room.setReady(player.id, true);
      room.start(`p${roomIndex}-1`, 0);
      room.tick(3_000);
    }
    const started = performance.now();
    for (let tick = 0; tick < 100; tick += 1)
      for (const room of manager.rooms.values()) room.tick(3_050 + tick * 50);
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(manager.rooms.size).toBe(50);
  });
});
