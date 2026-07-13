import Phaser from "phaser";

import type { MovementInput } from "./input-state";

export class KeyboardInput {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly action: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error("keyboard input is unavailable");
    this.cursors = keyboard.createCursorKeys();
    this.action = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  read(): MovementInput {
    return {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      jump:
        Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.space),
      action: Phaser.Input.Keyboard.JustDown(this.action),
    };
  }
}
