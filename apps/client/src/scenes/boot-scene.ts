import Phaser from "phaser";
import { PROTOCOL_VERSION } from "../../../../packages/protocol/src";

import { STAGES } from "../stages";
import { validateStage } from "../stages/validate";
import { applyPreferences, loadPreferences } from "../ui/preferences";
import { soundManager } from "../audio/sound-manager";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    this.registry.set("protocolVersion", PROTOCOL_VERSION);
    const preferences = loadPreferences();
    applyPreferences(preferences);
    soundManager.setPreferences(preferences);
    for (const stage of Object.values(STAGES)) {
      const errors = validateStage(stage);
      if (errors.length > 0) throw new Error(`${stage.id}: ${errors.join("; ")}`);
    }
    this.scene.start("lobby");
  }
}
