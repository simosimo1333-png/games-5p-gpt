import { describe, expect, it } from "vitest";

import { Room, RoomError } from "./room";
import { STAGE_RULES } from "./stage-rules";

describe("authoritative room", () => {
  it("rejects a seventh player", () => {
    const room = new Room("ABCDE", "p1", "Player 1", 0);
    for (let index = 2; index <= 6; index += 1) room.join(`p${index}`, `Player ${index}`, 0);
    expect(() => room.join("p7", "Player 7", 0)).toThrowError(RoomError);
    try {
      room.join("p7", "Player 7", 0);
    } catch (error) {
      expect(error).toMatchObject({ code: "ROOM_FULL" });
    }
  });

  it("rejects duplicate participation", () => {
    const room = new Room("ABCDE", "p1", "Player 1", 0);
    expect(() => room.join("p1", "Player 1", 1)).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_PLAYER" }),
    );
  });

  it("requires all players and the host before starting", () => {
    const room = new Room("ABCDE", "p1", "Player 1", 0);
    room.join("p2", "Player 2", 0);
    room.setReady("p1", true);
    expect(() => room.start("p2", 0)).toThrowError(expect.objectContaining({ code: "NOT_HOST" }));
    expect(() => room.start("p1", 0)).toThrowError(expect.objectContaining({ code: "NOT_READY" }));
    room.setReady("p2", true);
    room.start("p1", 0);
    expect(room.phase).toBe("countdown");
    room.tick(3_000);
    expect(room.phase).toBe("playing");
  });

  it("hands room control to the next friend when the host leaves", () => {
    const room = new Room("ABCDE", "p1", "Player 1", 0);
    room.join("p2", "Player 2", 0);
    room.join("p3", "Player 3", 0);

    room.remove("p1");

    expect(room.hostPlayerId).toBe("p2");
    room.setReady("p2", true);
    room.setReady("p3", true);
    room.start("p2", 0);
    expect(room.phase).toBe("countdown");
  });

  it("hands over control after the disconnected host's reconnect time expires", () => {
    const room = new Room("ABCDE", "p1", "Player 1", 0);
    room.join("p2", "Player 2", 0);

    room.disconnect("p1", 100);
    room.tick(30_101);

    expect(room.hostPlayerId).toBe("p2");
    expect(room.players.has("p1")).toBe(false);
  });

  it("reconnects with a valid short-lived token", () => {
    const room = new Room("ABCDE", "p1", "Player 1", 0);
    const joined = room.join("p2", "Player 2", 0);
    room.disconnect("p2", 100);
    expect(room.join("p2", "Player 2", 10_000, joined.reconnectToken)).toEqual(joined);
    room.disconnect("p2", 20_000);
    expect(() => room.join("p2", "Player 2", 51_000, joined.reconnectToken)).toThrowError(
      expect.objectContaining({ code: "RECONNECT_TOKEN_INVALID" }),
    );
  });

  it("pauses a two-player game during the reconnect grace period", () => {
    const room = new Room("ABCDE", "p1", "Player 1", 0);
    const joined = room.join("p2", "Player 2", 0);
    room.setReady("p1", true);
    room.setReady("p2", true);
    room.start("p1", 0);
    room.tick(3_000);
    room.tick(4_000);
    room.disconnect("p2", 4_000);
    room.tick(9_000);
    expect(room.phase).toBe("playing");
    expect(room.snapshot(9_000).remainingMs).toBe(179_000);
    room.join("p2", "Player 2", 10_000, joined.reconnectToken);
    expect(room.snapshot(10_000).remainingMs).toBe(179_000);
  });

  it("rate limits abusive input", () => {
    const room = new Room("ABCDE", "p1", "Player 1", 0);
    for (let sequence = 1; sequence <= 30; sequence += 1)
      room.applyInput("p1", { sequence, left: false, right: true, jump: false }, 10);
    expect(() =>
      room.applyInput("p1", { sequence: 31, left: false, right: true, jump: false }, 10),
    ).toThrowError(expect.objectContaining({ code: "RATE_LIMITED" }));
  });

  it("opens the cooperative gate only after two switches are held", () => {
    const room = new Room("ABCDE", "p1", "Player 1", 0);
    room.join("p2", "Player 2", 0);
    room.setReady("p1", true);
    room.setReady("p2", true);
    room.start("p1", 0);
    room.tick(3_000);
    room.applyInput("p1", { sequence: 1, left: false, right: true, jump: false }, 3_001);
    room.applyInput("p2", { sequence: 1, left: false, right: true, jump: false }, 3_001);
    let now = 3_000;
    for (let tick = 0; tick < 100; tick += 1) {
      now += 50;
      if (tick === 84)
        room.applyInput("p1", { sequence: 2, left: false, right: false, jump: false }, now);
      if (tick === 93)
        room.applyInput("p2", { sequence: 2, left: false, right: false, jump: false }, now);
      room.tick(now);
    }
    expect(room.gateOpen).toBe(false);
    for (let tick = 0; tick < 25; tick += 1) {
      now += 50;
      room.tick(now);
    }
    expect(room.gateOpen).toBe(true);
  });

  it("applies server-authoritative role abilities", () => {
    const room = new Room("ABCDE", "p1", "Runner", 0);
    room.join("p2", "Jumper", 0);
    room.setRole("p1", "runner");
    room.setRole("p2", "jumper");
    room.setReady("p1", true);
    room.setReady("p2", true);
    room.start("p1", 0);
    room.tick(3_000);
    room.applyInput("p1", { sequence: 1, left: false, right: true, jump: false }, 3_001);
    room.applyInput("p2", { sequence: 1, left: false, right: false, jump: true }, 3_001);
    room.tick(3_050);
    const snapshot = room.snapshot(3_050);
    expect(snapshot.players.find((player) => player.id === "p1")?.velocityX).toBe(310);
    expect(snapshot.players.find((player) => player.id === "p2")?.velocityY).toBeLessThan(-500);
    expect(() => room.setRole("p1", "supporter")).toThrowError(
      expect.objectContaining({ code: "ROOM_ALREADY_STARTED" }),
    );
  });

  it("lets only the host select each stage and difficulty", () => {
    for (const stageId of Object.keys(STAGE_RULES) as Array<keyof typeof STAGE_RULES>) {
      const room = new Room("ABCDE", "p1", "Host", 0);
      room.join("p2", "Guest", 0);
      expect(() => room.setGameOptions("p2", stageId, "casual")).toThrowError(
        expect.objectContaining({ code: "NOT_HOST" }),
      );
      room.setReady("p1", true);
      room.setReady("p2", true);
      room.setGameOptions("p1", stageId, "casual");
      expect(room.roomState().room).toMatchObject({ stageId, difficulty: "casual" });
      expect(room.roomState().room.players.every((player) => !player.ready)).toBe(true);
      room.setReady("p1", true);
      room.setReady("p2", true);
      room.start("p1", 0);
      room.tick(3_000);
      room.gateOpen = true;
      for (const player of room.players.values()) player.x = STAGE_RULES[stageId].finishX;
      room.tick(3_050);
      expect(room.finishedMessage(3_050)).toMatchObject({ result: "cleared" });
    }
  });

  it("lets a nearby teammate rescue a downed player and has an automatic fallback", () => {
    const room = new Room("ABCDE", "p1", "Helper", 0);
    room.join("p2", "Fallen", 0);
    room.setRole("p1", "supporter");
    room.setReady("p1", true);
    room.setReady("p2", true);
    room.start("p1", 0);
    room.tick(3_000);
    room.gateOpen = true;
    const helper = room.players.get("p1");
    const fallen = room.players.get("p2");
    expect(helper).toBeDefined();
    expect(fallen).toBeDefined();
    if (!helper || !fallen) return;
    helper.x = 2_200;
    fallen.x = 2_220;
    fallen.y = 681;
    room.tick(3_050);
    expect(room.snapshot(3_050).players.find((player) => player.id === "p2")?.downed).toBe(true);
    room.applyInput(
      "p1",
      { sequence: 1, left: false, right: false, jump: false, action: true },
      3_051,
    );
    room.tick(3_100);
    expect(room.snapshot(3_100).players.find((player) => player.id === "p2")?.downed).toBe(false);
    expect(helper.rescues).toBe(1);

    fallen.x = 2_220;
    fallen.y = 681;
    room.tick(3_150);
    expect(fallen.downed).toBe(true);
    room.tick(8_200);
    expect(fallen.downed).toBe(false);
  });

  it("keeps six-player simulation inside the tick performance budget", () => {
    const room = new Room("ABCDE", "p1", "Player 1", 0);
    for (let index = 2; index <= 6; index += 1) room.join(`p${index}`, `Player ${index}`, 0);
    for (let index = 1; index <= 6; index += 1) room.setReady(`p${index}`, true);
    room.start("p1", 0);
    room.tick(3_000);
    for (let index = 1; index <= 6; index += 1)
      room.applyInput(
        `p${index}`,
        { sequence: 1, left: false, right: true, jump: index % 2 === 0 },
        3_001,
      );
    const started = performance.now();
    for (let tick = 0; tick < 1_000; tick += 1) room.tick(3_050 + tick * 50);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("finishes for everyone and restarts only after unanimous retry votes", () => {
    const room = new Room("ABCDE", "p1", "Player 1", 0);
    room.join("p2", "Player 2", 0);
    room.setReady("p1", true);
    room.setReady("p2", true);
    room.start("p1", 0);
    room.tick(3_000);
    room.applyInput("p1", { sequence: 1, left: false, right: true, jump: false }, 3_001);
    room.applyInput("p2", { sequence: 1, left: false, right: true, jump: false }, 3_001);
    let now = 3_000;
    for (let tick = 0; tick < 100; tick += 1) {
      now += 50;
      if (tick === 84)
        room.applyInput("p1", { sequence: 2, left: false, right: false, jump: false }, now);
      if (tick === 93)
        room.applyInput("p2", { sequence: 2, left: false, right: false, jump: false }, now);
      room.tick(now);
    }
    for (let tick = 0; tick < 25; tick += 1) {
      now += 50;
      room.tick(now);
    }
    room.applyInput("p1", { sequence: 3, left: false, right: true, jump: false }, now);
    room.applyInput("p2", { sequence: 3, left: false, right: true, jump: false }, now);
    for (let tick = 0; tick < 130; tick += 1) {
      now += 50;
      if (tick === 50)
        room.applyInput("p2", { sequence: 4, left: false, right: true, jump: true }, now);
      if (tick === 55)
        room.applyInput("p2", { sequence: 5, left: false, right: true, jump: false }, now);
      if (tick === 64)
        room.applyInput("p1", { sequence: 4, left: false, right: true, jump: true }, now);
      if (tick === 69)
        room.applyInput("p1", { sequence: 5, left: false, right: true, jump: false }, now);
      room.tick(now);
    }
    expect(room.phase).toBe("finished");
    expect(room.finishedMessage(now)).toMatchObject({ result: "cleared" });
    expect(room.voteRetry("p1", true, now)).toBe(false);
    expect(room.voteRetry("p2", true, now)).toBe(true);
    expect(room.phase).toBe("countdown");
  });
});
