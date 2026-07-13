import type Phaser from "phaser";
import type { PlayerRole } from "../../../../packages/protocol/src";

import { PLAYER_MOVEMENT } from "../config/physics";
import type { MovementInput } from "../input/input-state";
import type { Point } from "../stages/types";

export class PlayerController {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private role: PlayerRole = "runner";

  constructor(scene: Phaser.Scene, spawn: Point) {
    this.sprite = scene.physics.add.sprite(spawn.x, spawn.y, "");
    this.sprite.setDisplaySize(56, 76).setTint(0xef4444);
    this.sprite.setCollideWorldBounds(true).setBounce(0.02);
    this.sprite.body?.setSize(48, 70);
  }

  update(input: MovementInput): void {
    const moveSpeed = this.role === "runner" ? 310 : PLAYER_MOVEMENT.moveSpeed;
    if (input.left === input.right) this.sprite.setVelocityX(0);
    else this.sprite.setVelocityX(input.left ? -moveSpeed : moveSpeed);

    const body = this.sprite.body;
    const grounded = body?.blocked.down === true || body?.touching.down === true;
    const jumpVelocity = this.role === "jumper" ? -560 : PLAYER_MOVEMENT.jumpVelocity;
    if (input.jump && grounded) this.sprite.setVelocityY(jumpVelocity);
  }

  setRole(role: PlayerRole): void {
    this.role = role;
  }

  recoverIfFallen(fallBoundary: number): boolean {
    if (this.sprite.y <= fallBoundary) return false;
    this.sprite.setPosition(Math.max(120, this.sprite.x - 220), 470).setVelocity(0, 0);
    return true;
  }
}
