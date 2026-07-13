import { describe, expect, it } from "vitest";

import { parseClientMessage, parseServerMessage, PROTOCOL_VERSION } from "./index";

describe("protocol runtime validation", () => {
  it("accepts a valid input message", () => {
    const result = parseClientMessage({
      version: PROTOCOL_VERSION,
      type: "input",
      sequence: 3,
      left: false,
      right: true,
      jump: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid room codes", () => {
    const result = parseClientMessage({
      version: PROTOCOL_VERSION,
      type: "join_room",
      roomCode: "bad code",
      player: { id: "p1", name: "Player" },
    });
    expect(result).toMatchObject({ success: false, error: { code: "INVALID_MESSAGE" } });
  });

  it("returns a stable compatibility error for an unsupported version", () => {
    const result = parseClientMessage({ version: 999, type: "ping", sentAt: 1 });
    expect(result).toEqual({
      success: false,
      error: {
        version: PROTOCOL_VERSION,
        type: "error",
        code: "PROTOCOL_VERSION_MISMATCH",
        supportedVersion: PROTOCOL_VERSION,
      },
    });
  });

  it("rejects snapshots with more than six players", () => {
    const players = Array.from({ length: 7 }, (_, index) => ({
      id: `p${index}`,
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      lastProcessedInput: 0,
    }));
    const result = parseServerMessage({
      version: PROTOCOL_VERSION,
      type: "snapshot",
      tick: 1,
      serverTime: 1,
      players,
    });
    expect(result).toMatchObject({ success: false, error: { code: "INVALID_MESSAGE" } });
  });

  it("rejects unknown message types", () => {
    const result = parseServerMessage({ version: PROTOCOL_VERSION, type: "unknown" });
    expect(result).toMatchObject({ success: false, error: { code: "INVALID_MESSAGE" } });
  });
});
