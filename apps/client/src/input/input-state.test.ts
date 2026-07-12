import { describe, expect, it } from "vitest";

import { InputState } from "./input-state";

describe("InputState", () => {
  it("tracks simultaneous touch pointers independently", () => {
    const state = new InputState();
    state.pressLeft(1);
    state.pressRight(2);
    expect(state.consume({ left: false, right: false, jump: false })).toMatchObject({
      left: true,
      right: true,
    });
    state.release(1);
    expect(state.consume({ left: false, right: false, jump: false })).toMatchObject({
      left: false,
      right: true,
    });
  });

  it("consumes a queued jump once", () => {
    const state = new InputState();
    state.queueJump();
    expect(state.consume({ left: false, right: false, jump: false }).jump).toBe(true);
    expect(state.consume({ left: false, right: false, jump: false }).jump).toBe(false);
  });

  it("clears every input after focus loss or cancellation", () => {
    const state = new InputState();
    state.pressLeft(1);
    state.queueJump();
    state.reset();
    expect(state.consume({ left: false, right: false, jump: false })).toEqual({
      left: false,
      right: false,
      jump: false,
    });
  });
});
