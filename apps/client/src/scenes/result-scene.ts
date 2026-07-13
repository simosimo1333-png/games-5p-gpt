import Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "../config/game";
import { networkClient } from "../network/network-client";

interface ResultData {
  readonly elapsedSeconds?: number;
  readonly result?: "aborted" | "cleared" | "timeout";
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super("result");
  }

  create(data: ResultData): void {
    const elapsed = data.elapsedSeconds ?? 0;
    const title =
      data.result === "cleared"
        ? "みんなで校門に到着！"
        : data.result === "timeout"
          ? "時間切れ"
          : "仲間との接続が終了しました";
    this.cameras.main.setBackgroundColor("#a7d8ff");
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 760, 360, 0x0f172a, 0.94);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 95, title, {
        fontFamily: "system-ui",
        fontSize: "48px",
        fontStyle: "bold",
        color: data.result === "cleared" ? "#facc15" : "#fff",
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 15, `タイム ${elapsed.toFixed(1)}秒`, {
        fontFamily: "system-ui",
        fontSize: "34px",
        color: "#fff",
      })
      .setOrigin(0.5);
    const retry = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70, "もう一度遊ぶ", {
        fontFamily: "system-ui",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#0f172a",
        backgroundColor: "#facc15",
        padding: { x: 28, y: 14 },
      })
      .setOrigin(0.5)
      .setInteractive();
    retry.on("pointerdown", () => {
      retry.setText("仲間の投票を待っています…");
      networkClient.voteRetry(true);
    });
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 140, "全員が『もう一度遊ぶ』を押すと再開します", {
        fontFamily: "system-ui",
        fontSize: "20px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);
    const dispose = networkClient.onMessage((message) => {
      if (message.type === "game_started") this.scene.start("game");
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose);
  }
}
