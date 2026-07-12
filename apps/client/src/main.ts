import Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "./config/game";
import "./style.css";

class FoundationScene extends Phaser.Scene {
  constructor() {
    super("foundation");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#a7d8ff");

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
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [FoundationScene],
});
