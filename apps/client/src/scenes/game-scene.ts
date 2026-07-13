import Phaser from "phaser";
import type { ServerMessage } from "../../../../packages/protocol/src";

import { GAME_WIDTH } from "../config/game";
import { PlayerController } from "../entities/player-controller";
import { InputController } from "../input/input-controller";
import { networkClient } from "../network/network-client";
import { SnapshotInterpolator } from "../network/snapshot-interpolator";
import { SCHOOL_GATE_STAGE } from "../stages/school-gate";
import { Hud } from "../ui/hud";

export class GameScene extends Phaser.Scene {
  private cleanup: Array<() => void> = [];
  private finished = false;
  private gate!: Phaser.GameObjects.Rectangle;
  private switches: Phaser.GameObjects.Rectangle[] = [];
  private hud!: Hud;
  private inputController!: InputController;
  private player!: PlayerController;
  private readonly remotePlayers = new Map<
    string,
    {
      indicator: Phaser.GameObjects.Text;
      sprite: Phaser.GameObjects.Rectangle;
      targetX: number;
      targetY: number;
    }
  >();
  private readonly playerColors = new Map<string, number>();
  private readonly snapshots = new SnapshotInterpolator();
  private inputSequence = 0;
  private lastInputSentAt = 0;
  private startedAt = 0;

  constructor() {
    super("game");
  }

  create(): void {
    this.finished = false;
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

    this.gate = this.add.rectangle(1_540, 430, 36, 300, 0x334155).setDepth(5);
    this.switches = [1_250, 1_430].map((x) =>
      this.add.rectangle(x, 570, 110, 20, 0xf59e0b).setDepth(6),
    );
    this.add.rectangle(2_270, 640, 180, 160, 0x0f172a).setDepth(-1);
    this.inputController = new InputController(this);
    this.hud = new Hud(this);
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08, -240, 80);
    this.cameras.main.setBounds(
      0,
      0,
      SCHOOL_GATE_STAGE.world.width,
      SCHOOL_GATE_STAGE.world.height,
    );
    this.startedAt = performance.now();
    if (networkClient.roomState) this.applyRoomState(networkClient.roomState);
    this.cleanup.push(
      networkClient.onMessage((message) => {
        if (message.type === "snapshot") this.applySnapshot(message);
        else if (message.type === "room_state") this.applyRoomState(message);
        else if (message.type === "game_finished") this.finish(message.result, message.elapsedMs);
      }),
    );
    this.cleanup.push(
      networkClient.onState((state) =>
        this.hud.setConnection(
          state === "connected"
            ? "接続済み"
            : state === "reconnecting"
              ? "仲間を待っています…"
              : "通信が切れました",
          state === "connected",
        ),
      ),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const dispose of this.cleanup) dispose();
      this.cleanup = [];
      this.remotePlayers.clear();
    });
  }

  override update(): void {
    if (this.finished) return;
    const input = this.inputController.read();
    this.player.update(input);
    if (performance.now() - this.lastInputSentAt >= 50 || input.jump || input.action) {
      this.inputSequence += 1;
      networkClient.sendInput(
        this.inputSequence,
        input.left,
        input.right,
        input.jump,
        input.action,
      );
      this.lastInputSentAt = performance.now();
    }
    for (const remote of this.remotePlayers.values()) {
      remote.sprite.x = Phaser.Math.Linear(remote.sprite.x, remote.targetX, 0.22);
      remote.sprite.y = Phaser.Math.Linear(remote.sprite.y, remote.targetY, 0.22);
    }
    for (const [id, remote] of this.remotePlayers) {
      const sample = this.snapshots.sample(id, Date.now() - 100);
      if (sample) {
        remote.targetX = sample.x;
        remote.targetY = sample.y;
      }
      const screenX = remote.targetX - this.cameras.main.scrollX;
      const outside = screenX < 0 || screenX > GAME_WIDTH;
      remote.indicator
        .setVisible(outside)
        .setText(screenX < 0 ? "◀ 仲間" : "仲間 ▶")
        .setPosition(
          screenX < 0 ? 20 : GAME_WIDTH - 20,
          Math.max(140, Math.min(620, remote.targetY)),
        )
        .setOrigin(screenX < 0 ? 0 : 1, 0.5);
    }
    this.hud.update((performance.now() - this.startedAt) / 1000);
  }

  private applySnapshot(message: Extract<ServerMessage, { type: "snapshot" }>): void {
    this.snapshots.push(message);
    this.hud.setRemaining(message.remainingMs);
    this.gate.setVisible(!message.gateOpen);
    for (const floorSwitch of this.switches)
      floorSwitch.setFillStyle(message.gateOpen ? 0x22c55e : 0xf59e0b);
    const localId = networkClient.session?.playerId;
    for (const state of message.players) {
      if (state.id === localId) {
        this.player.sprite.setAlpha(state.downed ? 0.45 : 1);
        const distance = Phaser.Math.Distance.Between(
          this.player.sprite.x,
          this.player.sprite.y,
          state.x,
          state.y,
        );
        if (distance > 160) this.player.sprite.setPosition(state.x, state.y);
        else
          this.player.sprite.setPosition(
            Phaser.Math.Linear(this.player.sprite.x, state.x, 0.35),
            Phaser.Math.Linear(this.player.sprite.y, state.y, 0.35),
          );
        continue;
      }
      let remote = this.remotePlayers.get(state.id);
      if (!remote) {
        const color = this.playerColors.get(state.id) ?? 0x3b82f6;
        const sprite = this.add.rectangle(state.x, state.y, 56, 76, color).setDepth(8);
        const indicator = this.add
          .text(0, 0, "仲間", {
            fontFamily: "system-ui",
            fontSize: "22px",
            fontStyle: "bold",
            color: `#${color.toString(16).padStart(6, "0")}`,
            backgroundColor: "#0f172acc",
            padding: { x: 10, y: 6 },
          })
          .setScrollFactor(0)
          .setDepth(30)
          .setVisible(false);
        remote = { indicator, sprite, targetX: state.x, targetY: state.y };
        this.remotePlayers.set(state.id, remote);
      }
      remote.targetX = state.x;
      remote.targetY = state.y;
      remote.sprite.setAlpha(state.downed ? 0.45 : 1);
    }
  }

  private applyRoomState(message: Extract<ServerMessage, { type: "room_state" }>): void {
    this.hud.setPlayers(
      message.room.players.filter((item) => item.connected).length,
      message.room.players.length,
    );
    for (const player of message.room.players) {
      const color = Number.parseInt(player.color.slice(1), 16);
      this.playerColors.set(player.id, color);
      if (player.id === networkClient.session?.playerId) this.player.sprite.setTint(color);
      if (player.id === networkClient.session?.playerId) this.player.setRole(player.role);
      else this.remotePlayers.get(player.id)?.sprite.setFillStyle(color);
    }
  }

  private finish(result: "aborted" | "cleared" | "timeout", elapsedMs: number): void {
    if (this.finished) return;
    this.finished = true;
    this.inputController.reset();
    this.physics.pause();
    this.scene.start("result", { elapsedSeconds: elapsedMs / 1000, result });
  }
}
