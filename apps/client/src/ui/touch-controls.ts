import Phaser from "phaser";

import type { InputState } from "../input/input-state";

export class TouchControls {
  constructor(scene: Phaser.Scene, input: InputState) {
    this.addButton(
      scene,
      92,
      "◀",
      (id) => input.pressLeft(id),
      (id) => input.release(id),
    );
    this.addButton(
      scene,
      226,
      "▶",
      (id) => input.pressRight(id),
      (id) => input.release(id),
    );
    this.addButton(
      scene,
      1160,
      "JUMP",
      () => input.queueJump(),
      () => undefined,
    );
    this.addButton(
      scene,
      1018,
      "HELP",
      () => input.queueAction(),
      () => undefined,
    );
    scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => input.release(pointer.id));
    scene.input.on("gameout", () => input.reset());

    const reset = (): void => input.reset();
    const visibilityChanged = (): void => {
      if (document.hidden) reset();
    };
    const canvas = scene.game.canvas;
    canvas.addEventListener("pointercancel", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibilityChanged);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener("pointercancel", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibilityChanged);
      input.reset();
    });
  }

  private addButton(
    scene: Phaser.Scene,
    x: number,
    label: string,
    down: (id: number) => void,
    up: (id: number) => void,
  ): void {
    const button = scene.add
      .circle(x, 630, 58, 0x0f172a, 0.72)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive();
    scene.add
      .text(x, 630, label, {
        fontSize: label === "JUMP" || label === "HELP" ? "21px" : "34px",
        color: "#fff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(31);
    button.on("pointerdown", (pointer: Phaser.Input.Pointer) => down(pointer.id));
    button.on("pointerup", (pointer: Phaser.Input.Pointer) => up(pointer.id));
    button.on("pointerout", (pointer: Phaser.Input.Pointer) => up(pointer.id));
  }
}
