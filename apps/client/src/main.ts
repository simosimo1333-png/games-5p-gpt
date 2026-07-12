import Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "./config/game";
import { WORLD_PHYSICS } from "./config/physics";
import { SCHOOL_GATE_STAGE } from "./stages/school-gate";
import { validateStage } from "./stages/validate";
import "./style.css";

class FoundationScene extends Phaser.Scene {
  constructor() {
    super("foundation");
  }

  create(): void {
    const stageErrors = validateStage(SCHOOL_GATE_STAGE);
    if (stageErrors.length > 0) throw new Error(stageErrors.join("; "));

    this.cameras.main.setBackgroundColor("#a7d8ff");

    for (const platform of SCHOOL_GATE_STAGE.platforms) {
      this.add.rectangle(platform.x, platform.y, platform.width, platform.height, platform.color);
    }

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, "放課後ダッシュ！", {
        color: "#0f172a",
        fontFamily: "system-ui, sans-serif",
        fontSize: "64px",
        fontStyle: "bold",
        stroke: "#ffffff",
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 25, "新しい開発環境の準備ができました", {
        backgroundColor: "#0f172acc",
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        padding: { x: 24, y: 14 },
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 105, "現在のゲームは段階的にこちらへ移行します", {
        color: "#334155",
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
      })
      .setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#a7d8ff",
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: WORLD_PHYSICS.gravityY }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [FoundationScene],
});
