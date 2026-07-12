import { describe, expect, it } from "vitest";

import { SCHOOL_GATE_STAGE } from "./school-gate";
import type { StageData } from "./types";
import { validateStage } from "./validate";

describe("stage validation", () => {
  it("accepts the school gate stage", () => {
    expect(validateStage(SCHOOL_GATE_STAGE)).toEqual([]);
  });

  it("rejects duplicate platform ids", () => {
    const stage: StageData = {
      ...SCHOOL_GATE_STAGE,
      platforms: [SCHOOL_GATE_STAGE.platforms[0], SCHOOL_GATE_STAGE.platforms[0]],
    };

    expect(validateStage(stage)).toContain("duplicate platform id: desk-1");
  });

  it("rejects stage elements outside the world", () => {
    const stage: StageData = {
      ...SCHOOL_GATE_STAGE,
      playerSpawn: { x: -1, y: 0 },
    };

    expect(validateStage(stage)).toContain("player spawn must be inside the world");
  });
});
