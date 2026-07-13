import type Phaser from "phaser";

export class Hud {
  private readonly connection: Phaser.GameObjects.Text;
  private readonly objective: Phaser.GameObjects.Text;
  private readonly players: Phaser.GameObjects.Text;
  private readonly timer: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    scene.add
      .text(120, 115, "放課後ダッシュ！", {
        fontFamily: "system-ui",
        fontSize: "56px",
        fontStyle: "bold",
        color: "#0f172a",
        stroke: "#fff",
        strokeThickness: 8,
      })
      .setScrollFactor(0);
    this.timer = scene.add
      .text(1050, 40, "残り --", {
        fontFamily: "monospace",
        fontSize: "30px",
        color: "#fff",
        backgroundColor: "#0f172acc",
        padding: { x: 18, y: 10 },
      })
      .setScrollFactor(0)
      .setDepth(20);
    this.players = scene.add
      .text(38, 40, "参加者 0/6", {
        fontFamily: "system-ui",
        fontSize: "24px",
        color: "#fff",
        backgroundColor: "#0f172acc",
        padding: { x: 14, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(20);
    this.connection = scene.add
      .text(38, 90, "接続済み", {
        fontFamily: "system-ui",
        fontSize: "20px",
        color: "#bbf7d0",
        backgroundColor: "#0f172acc",
        padding: { x: 12, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(20);
    this.objective = scene.add
      .text(640, 670, "床スイッチは仲間と同時に！　倒れた仲間の近くで HELP / E", {
        fontFamily: "system-ui",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#fff",
        backgroundColor: "#0f172acc",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);
  }

  setRemaining(remainingMs: number): void {
    this.timer
      .setText(`残り ${(remainingMs / 1000).toFixed(1)}秒`)
      .setColor(remainingMs <= 30_000 ? "#fecaca" : "#fff");
  }
  setObjective(text: string, urgent = false): void {
    this.objective.setText(text).setColor(urgent ? "#fde68a" : "#fff");
  }
  setPlayers(connected: number, total: number): void {
    this.players.setText(`参加者 ${connected}/${total}`);
  }
  setConnection(text: string, healthy: boolean): void {
    this.connection.setText(text).setColor(healthy ? "#bbf7d0" : "#fecaca");
  }
}
