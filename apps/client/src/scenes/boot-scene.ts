import Phaser from "phaser";

import { SCHOOL_GATE_STAGE } from "../stages/school-gate";
import { validateStage } from "../stages/validate";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    const errors = validateStage(SCHOOL_GATE_STAGE);
    if (errors.length > 0) throw new Error(errors.join("; "));
    this.scene.start("game");
  }
}
