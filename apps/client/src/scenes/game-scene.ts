import Phaser from "phaser";
import type { ServerMessage, StageId } from "../../../../packages/protocol/src";

import { GAME_WIDTH } from "../config/game";
import { PlayerController } from "../entities/player-controller";
import { InputController } from "../input/input-controller";
import { networkClient } from "../network/network-client";
import { soundManager } from "../audio/sound-manager";
import { SnapshotInterpolator } from "../network/snapshot-interpolator";
import { STAGES } from "../stages";
import type { StageData } from "../stages/types";
import { Hud } from "../ui/hud";
import { loadPreferences } from "../ui/preferences";

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
  private stage!: StageData;
  private gateWasOpen = false;
  private reducedMotion = false;
  private readonly downedPlayers = new Set<string>();

  constructor() {
    super("game");
  }

  create(data: { stageId?: StageId }): void {
    const selected = data.stageId ?? networkClient.roomState?.room.stageId ?? "school-gate";
    this.stage = STAGES[selected];
    this.reducedMotion = loadPreferences().reducedMotion;
    this.gateWasOpen = false;
    this.downedPlayers.clear();
    soundManager.play("start");
    this.finished = false;
    this.physics.resume();
    this.physics.world.setBounds(0, 0, this.stage.world.width, this.stage.world.height);
    this.cameras.main.setBackgroundColor(
      this.stage.id === "rooftop-relay"
        ? "#7dd3fc"
        : this.stage.id === "gym-escape"
          ? "#fde68a"
          : "#a7d8ff",
    );

    this.add
      .rectangle(this.stage.world.width / 2, 650, this.stage.world.width, 140, 0x84a85c)
      .setDepth(-3);
    this.add
      .rectangle(this.stage.world.width / 2, 590, this.stage.world.width, 20, 0xb8c48c)
      .setDepth(-2);

    const platforms = this.physics.add.staticGroup();
    for (const platformData of this.stage.platforms) {
      const platform = this.add.rectangle(
        platformData.x,
        platformData.y,
        platformData.width,
        platformData.height,
        platformData.color,
      );
      this.physics.add.existing(platform, true);
      platforms.add(platform);
    }

    this.player = new PlayerController(this, this.stage.playerSpawn);
    this.physics.add.collider(this.player.sprite, platforms);

    const gate = this.stage.mechanics.gate;
    this.gate = this.add.rectangle(gate.x, gate.y, gate.width, gate.height, 0x334155).setDepth(5);
    this.switches = this.stage.mechanics.switches.map((x) =>
      this.add.rectangle(x, 570, 110, 20, 0xf59e0b).setDepth(6),
    );
    const pit = this.stage.mechanics.pit;
    this.add.rectangle(pit.x, pit.y, pit.width, pit.height, 0x0f172a).setDepth(-1);
    this.inputController = new InputController(this);
    this.hud = new Hud(this);
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08, -240, 80);
    this.cameras.main.setBounds(0, 0, this.stage.world.width, this.stage.world.height);
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
      const smoothing = this.reducedMotion ? 1 : 0.22;
      remote.sprite.x = Phaser.Math.Linear(remote.sprite.x, remote.targetX, smoothing);
      remote.sprite.y = Phaser.Math.Linear(remote.sprite.y, remote.targetY, smoothing);
    }
    for (const [id, remote] of this.remotePlayers) {
      const sample = this.snapshots.sample(id, Date.now() - 100);
      if (sample) {
        remote.targetX = sample.x;
        remote.targetY = sample.y;
      }
      const screenX = remote.targetX - this.cameras.main.scrollX;
      const outside = screenX < 0 || screenX > GAME_WIDTH;
      const needsHelp = this.downedPlayers.has(id);
      remote.indicator
        .setVisible(outside)
        .setText(
          screenX < 0
            ? `◀ ${needsHelp ? "助けて！" : "仲間"}`
            : `${needsHelp ? "助けて！" : "仲間"} ▶`,
        )
        .setPosition(
          screenX < 0 ? 20 : GAME_WIDTH - 20,
          Math.max(140, Math.min(620, remote.targetY)),
        )
        .setOrigin(screenX < 0 ? 0 : 1, 0.5);
    }
  }

  private applySnapshot(message: Extract<ServerMessage, { type: "snapshot" }>): void {
    this.snapshots.push(message);
    this.hud.setRemaining(message.remainingMs);
    this.gate.setVisible(!message.gateOpen);
    if (message.gateOpen && !this.gateWasOpen) soundManager.play("gate");
    this.gateWasOpen = message.gateOpen;
    for (const floorSwitch of this.switches)
      floorSwitch.setFillStyle(message.gateOpen ? 0x22c55e : 0xf59e0b);
    const localId = networkClient.session?.playerId;
    for (const state of message.players) {
      if (state.downed) this.downedPlayers.add(state.id);
      else if (this.downedPlayers.delete(state.id)) soundManager.play("rescue");
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
            Phaser.Math.Linear(this.player.sprite.x, state.x, this.reducedMotion ? 1 : 0.35),
            Phaser.Math.Linear(this.player.sprite.y, state.y, this.reducedMotion ? 1 : 0.35),
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
    const localDowned = message.players.some((player) => player.id === localId && player.downed);
    const friendsDowned = message.players.filter(
      (player) => player.id !== localId && player.downed,
    ).length;
    if (localDowned) this.hud.setObjective("倒れました—仲間の救助を待とう", true);
    else if (friendsDowned > 0)
      this.hud.setObjective(`倒れた仲間が${friendsDowned}人—近くで HELP / E`, true);
    else if (message.gateOpen) this.hud.setObjective("門が開いた！ 全員でゴールへ");
    else this.hud.setObjective("床スイッチは仲間と同時に！");
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
    if (result === "cleared") soundManager.play("finish");
    this.inputController.reset();
    this.physics.pause();
    this.scene.start("result", { elapsedSeconds: elapsedMs / 1000, result });
  }
}
