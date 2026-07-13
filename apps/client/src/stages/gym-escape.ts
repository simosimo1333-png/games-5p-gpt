import type { StageData } from "./types";

export const GYM_ESCAPE_STAGE = {
  id: "gym-escape",
  name: "体育館脱出！",
  world: { width: 2800, height: 720 },
  playerSpawn: { x: 150, y: 500 },
  finish: { x: 2520, y: 470, width: 24, height: 240 },
  mechanics: {
    gate: { x: 1080, y: 430, width: 36, height: 300 },
    pit: { x: 1740, y: 640, width: 180, height: 160 },
    switches: [780, 960],
  },
  platforms: [
    { id: "floor", x: 1400, y: 650, width: 2800, height: 140, color: 0xb45309 },
    { id: "mat-1", x: 430, y: 540, width: 260, height: 28, color: 0x2563eb },
    { id: "horse", x: 700, y: 450, width: 180, height: 34, color: 0xf59e0b },
    { id: "bench", x: 1320, y: 510, width: 280, height: 30, color: 0x92400e },
    { id: "stage-1", x: 2060, y: 480, width: 260, height: 34, color: 0x7c3aed },
    { id: "stage-2", x: 2350, y: 380, width: 220, height: 34, color: 0x7c3aed },
  ],
} as const satisfies StageData;
