import Phaser from "phaser";

import { PlayerController } from "../entities/player-controller";
import { InputState } from "../input/input-state";
import { KeyboardInput } from "../input/keyboard-input";
import { SCHOOL_GATE_STAGE } from "../stages/school-gate";
import { Hud } from "../ui/hud";
import { TouchControls } from "../ui/touch-controls";

export class GameScene extends Phaser.Scene {
  private readonly inputState = new InputState();
  private finished = false;
  private hud!: Hud;
  private keyboardInput!: KeyboardInput;
  private player!: PlayerController;
  private startedAt = 0;

  constructor() {
    super("game");
  }

  create(): void {
    this.finished = false;
    this.inputState.reset();
    this.physics.resume();
    this.physics.world.setBounds(
      0,
      0,
      SCHOOL_GATE_STAGE.world.width,
      SCHOOL_GATE_STAGE.world.height,
    );
    this.cameras.main.setBackgroundColor("#a7d8ff");

    this.add
      .rectangle(
        SCHOOL_GATE_STAGE.world.width / 2,
        650,
        SCHOOL_GATE_STAGE.world.width,
        140,
        0x84a85c,
      )
      .setDepth(-3);
    this.add
      .rectangle(
        SCHOOL_GATE_STAGE.world.width / 2,
        590,
        SCHOOL_GATE_STAGE.world.width,
        20,
        0xb8c48c,
      )
      .setDepth(-2);

    const platforms = this.physics.add.staticGroup();
    for (const data of SCHOOL_GATE_STAGE.platforms) {
      const platform = this.add.rectangle(data.x, data.y, data.width, data.height, data.color);
      this.physics.add.existing(platform, true);
      platforms.add(platform);
    }

    this.player = new PlayerController(this, SCHOOL_GATE_STAGE.playerSpawn);
    this.physics.add.collider(this.player.sprite, platforms);

    const finish = this.add.rectangle(
      SCHOOL_GATE_STAGE.finish.x,
      SCHOOL_GATE_STAGE.finish.y,
      SCHOOL_GATE_STAGE.finish.width,
      SCHOOL_GATE_STAGE.finish.height,
      0xfacc15,
    );
    this.physics.add.existing(finish, true);
    this.physics.add.overlap(this.player.sprite, finish, () => this.finish());
    this.add.text(2780, 310, "校門\nGOAL", {
      align: "center",
      fontFamily: "system-ui",
      fontSize: "30px",
      fontStyle: "bold",
      color: "#7c2d12",
    });

    this.keyboardInput = new KeyboardInput(this);
    new TouchControls(this, this.inputState);
    this.hud = new Hud(this);
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08, -240, 80);
    this.cameras.main.setBounds(
      0,
      0,
      SCHOOL_GATE_STAGE.world.width,
      SCHOOL_GATE_STAGE.world.height,
    );
    this.startedAt = performance.now();
  }

  override update(): void {
    if (this.finished) return;
    const keyboard = this.keyboardInput.read();
    this.player.update(this.inputState.consume(keyboard));
    this.player.recoverIfFallen(690);
    this.hud.update((performance.now() - this.startedAt) / 1000);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.inputState.reset();
    this.physics.pause();
    this.scene.start("result", { elapsedSeconds: (performance.now() - this.startedAt) / 1000 });
  }
}
