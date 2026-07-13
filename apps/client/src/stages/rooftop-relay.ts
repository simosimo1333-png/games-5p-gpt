import type { StageData } from "./types";

export const ROOFTOP_RELAY_STAGE = {
  id: "rooftop-relay",
  name: "屋上リレー！",
  world: { width: 3600, height: 720 },
  playerSpawn: { x: 150, y: 500 },
  finish: { x: 3300, y: 430, width: 24, height: 280 },
  mechanics: {
    gate: { x: 1320, y: 410, width: 36, height: 340 },
    pit: { x: 2200, y: 640, width: 240, height: 160 },
    switches: [1020, 1200],
  },
  platforms: [
    { id: "roof", x: 1800, y: 650, width: 3600, height: 140, color: 0x64748b },
    { id: "duct-1", x: 520, y: 520, width: 240, height: 36, color: 0x94a3b8 },
    { id: "duct-2", x: 850, y: 430, width: 180, height: 36, color: 0x94a3b8 },
    { id: "tank-step", x: 1550, y: 500, width: 280, height: 32, color: 0x38bdf8 },
    { id: "bridge-step", x: 1900, y: 410, width: 240, height: 32, color: 0x38bdf8 },
    { id: "goal-1", x: 2700, y: 500, width: 300, height: 32, color: 0xf59e0b },
    { id: "goal-2", x: 3100, y: 390, width: 260, height: 32, color: 0xf59e0b },
  ],
} as const satisfies StageData;
