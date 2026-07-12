import Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "../config/game";

interface ResultData {
  readonly elapsedSeconds?: number;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super("result");
  }

  create(data: ResultData): void {
    const elapsed = data.elapsedSeconds ?? 0;
    this.cameras.main.setBackgroundColor("#a7d8ff");
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 720, 300, 0x0f172a, 0.94);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, "校門に到着！", {
        fontFamily: "system-ui",
        fontSize: "54px",
        fontStyle: "bold",
        color: "#facc15",
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `タイム ${elapsed.toFixed(1)}秒`, {
        fontFamily: "system-ui",
        fontSize: "34px",
        color: "#fff",
      })
      .setOrigin(0.5);
    const retry = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90, "もう一度遊ぶ", {
        fontFamily: "system-ui",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#0f172a",
        backgroundColor: "#facc15",
        padding: { x: 28, y: 14 },
      })
      .setOrigin(0.5)
      .setInteractive();
    retry.on("pointerdown", () => this.scene.start("game"));
  }
}
