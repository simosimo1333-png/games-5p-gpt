import type { StageId } from "../../../../packages/protocol/src";
import { GYM_ESCAPE_STAGE } from "./gym-escape";
import { ROOFTOP_RELAY_STAGE } from "./rooftop-relay";
import { SCHOOL_GATE_STAGE } from "./school-gate";
import type { StageData } from "./types";

export const STAGES: Record<StageId, StageData> = {
  "school-gate": SCHOOL_GATE_STAGE,
  "rooftop-relay": ROOFTOP_RELAY_STAGE,
  "gym-escape": GYM_ESCAPE_STAGE,
};
