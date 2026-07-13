import type { Difficulty, StageId } from "../../../packages/protocol/src";

export interface StageRules {
  readonly checkpointX: number;
  readonly finishX: number;
  readonly gateX: number;
  readonly pit: readonly [number, number];
  readonly switches: readonly [number, number];
  readonly worldMaxX: number;
}

export const STAGE_RULES: Record<StageId, StageRules> = {
  "school-gate": {
    worldMaxX: 3_080,
    switches: [1_250, 1_430],
    gateX: 1_520,
    pit: [2_180, 2_360],
    checkpointX: 1_900,
    finishX: 2_820,
  },
  "rooftop-relay": {
    worldMaxX: 3_480,
    switches: [1_020, 1_200],
    gateX: 1_300,
    pit: [2_080, 2_320],
    checkpointX: 1_800,
    finishX: 3_270,
  },
  "gym-escape": {
    worldMaxX: 2_680,
    switches: [780, 960],
    gateX: 1_060,
    pit: [1_650, 1_830],
    checkpointX: 1_400,
    finishX: 2_490,
  },
};

export const DIFFICULTY_DURATION_MS: Record<Difficulty, number> = {
  casual: 240_000,
  standard: 180_000,
  challenge: 150_000,
};

export const AUTO_REVIVE_MS: Record<Difficulty, number> = {
  casual: 3_000,
  standard: 5_000,
  challenge: 7_000,
};
