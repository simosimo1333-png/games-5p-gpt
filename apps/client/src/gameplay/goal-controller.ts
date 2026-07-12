import type Phaser from "phaser";

import type { RectangleData } from "../stages/types";

export class GoalController {
  constructor(
    scene: Phaser.Scene,
    player: Phaser.Physics.Arcade.Sprite,
    finishData: RectangleData,
    onReached: () => void,
  ) {
    const finish = scene.add.rectangle(
      finishData.x,
      finishData.y,
      finishData.width,
      finishData.height,
      0xfacc15,
    );
    scene.physics.add.existing(finish, true);
    scene.physics.add.overlap(player, finish, onReached);
    scene.add.text(finishData.x - 70, finishData.y - 160, "校門\nGOAL", {
      align: "center",
      fontFamily: "system-ui",
      fontSize: "30px",
      fontStyle: "bold",
      color: "#7c2d12",
    });
  }
}
