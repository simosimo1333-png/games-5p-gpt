import type { StageData } from "./types";

export const SCHOOL_GATE_STAGE = {
  id: "school-gate",
  name: "校門まで走れ！",
  world: { width: 3200, height: 720 },
  playerSpawn: { x: 150, y: 500 },
  finish: { x: 2850, y: 470, width: 24, height: 240 },
  platforms: [
    { id: "desk-1", x: 480, y: 530, width: 240, height: 32, color: 0xd9b38c },
    { id: "desk-2", x: 820, y: 450, width: 180, height: 32, color: 0xd9b38c },
    { id: "desk-3", x: 1180, y: 380, width: 220, height: 32, color: 0xd9b38c },
    { id: "stairs-1", x: 1570, y: 500, width: 320, height: 32, color: 0x64748b },
    { id: "stairs-2", x: 2050, y: 420, width: 260, height: 32, color: 0x64748b },
    { id: "goal-step", x: 2500, y: 340, width: 260, height: 32, color: 0xf59e0b },
  ],
} as const satisfies StageData;
