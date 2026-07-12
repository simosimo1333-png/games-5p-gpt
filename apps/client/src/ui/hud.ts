import type Phaser from "phaser";

export class Hud {
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
      .text(1050, 40, "0.0秒", {
        fontFamily: "monospace",
        fontSize: "30px",
        color: "#fff",
        backgroundColor: "#0f172acc",
        padding: { x: 18, y: 10 },
      })
      .setScrollFactor(0)
      .setDepth(20);
  }

  update(elapsedSeconds: number): void {
    this.timer.setText(`${elapsedSeconds.toFixed(1)}秒`);
  }
}
