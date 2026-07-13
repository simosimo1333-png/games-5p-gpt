import { randomBytes } from "node:crypto";

import {
  MAX_PLAYERS,
  PROTOCOL_VERSION,
  type Difficulty,
  type PlayerRole,
  type PlayerSnapshot,
  type PlayerSummary,
  type ServerMessage,
  type StageId,
} from "../../../packages/protocol/src";
import { AUTO_REVIVE_MS, DIFFICULTY_DURATION_MS, STAGE_RULES } from "./stage-rules";

const PLAYER_COLORS = ["#EF4444", "#3B82F6", "#22C55E", "#EAB308", "#A855F7", "#F97316"] as const;
const RECONNECT_GRACE_MS = 30_000;
const INPUTS_PER_SECOND = 30;

export type RoomPhase = "lobby" | "countdown" | "playing" | "finished";

export class RoomError extends Error {
  constructor(
    readonly code: Extract<ServerMessage, { type: "error" }>["code"],
    message: string,
  ) {
    super(message);
  }
}

interface PlayerState {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  color: string;
  role: PlayerRole;
  reconnectToken: string;
  disconnectedAt?: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  left: boolean;
  right: boolean;
  jump: boolean;
  action: boolean;
  jumpConsumed: boolean;
  lastProcessedInput: number;
  inputWindowAt: number;
  inputCount: number;
  checkpointX: number;
  finished: boolean;
  downed: boolean;
  downedAt?: number;
  rescues: number;
  retry: boolean;
}

export interface JoinResult {
  playerId: string;
  reconnectToken: string;
}

export class Room {
  readonly players = new Map<string, PlayerState>();
  hostPlayerId: string;
  phase: RoomPhase = "lobby";
  gateOpen = false;
  stageId: StageId = "school-gate";
  difficulty: Difficulty = "standard";
  tickNumber = 0;
  private countdownEndsAt = 0;
  private gameStartedAt = 0;
  private pausedAt: number | undefined;
  private switchHeldSince: number | undefined;
  private result: "aborted" | "cleared" | "timeout" | undefined;

  constructor(
    readonly code: string,
    hostPlayerId: string,
    hostName: string,
    now = Date.now(),
  ) {
    this.hostPlayerId = hostPlayerId;
    this.addNewPlayer(hostPlayerId, hostName, now);
  }

  join(playerId: string, name: string, now = Date.now(), reconnectToken?: string): JoinResult {
    const existing = this.players.get(playerId);
    if (existing) {
      if (
        !reconnectToken ||
        reconnectToken !== existing.reconnectToken ||
        existing.disconnectedAt === undefined ||
        now - existing.disconnectedAt > RECONNECT_GRACE_MS
      ) {
        throw new RoomError(
          reconnectToken ? "RECONNECT_TOKEN_INVALID" : "DUPLICATE_PLAYER",
          "同じプレイヤーは既に参加しています",
        );
      }
      existing.connected = true;
      delete existing.disconnectedAt;
      if (this.pausedAt !== undefined) {
        this.gameStartedAt += now - this.pausedAt;
        this.pausedAt = undefined;
      }
      return { playerId, reconnectToken: existing.reconnectToken };
    }
    if (this.phase !== "lobby")
      throw new RoomError("ROOM_ALREADY_STARTED", "ゲーム開始後は参加できません");
    if (this.players.size >= MAX_PLAYERS) throw new RoomError("ROOM_FULL", "ルームは満員です");
    return this.addNewPlayer(playerId, name, now);
  }

  setReady(playerId: string, ready: boolean): void {
    this.requirePlayer(playerId).ready = ready;
  }

  setRole(playerId: string, role: PlayerRole): void {
    if (this.phase !== "lobby")
      throw new RoomError("ROOM_ALREADY_STARTED", "ゲーム開始後は役割を変更できません");
    const player = this.requirePlayer(playerId);
    player.role = role;
    player.ready = false;
  }

  setGameOptions(playerId: string, stageId: StageId, difficulty: Difficulty): void {
    if (playerId !== this.hostPlayerId)
      throw new RoomError("NOT_HOST", "作成者だけがステージと難易度を変更できます");
    if (this.phase !== "lobby")
      throw new RoomError("ROOM_ALREADY_STARTED", "ゲーム開始後は設定を変更できません");
    this.stageId = stageId;
    this.difficulty = difficulty;
    for (const player of this.players.values()) player.ready = false;
  }

  start(playerId: string, now = Date.now()): void {
    if (playerId !== this.hostPlayerId) throw new RoomError("NOT_HOST", "作成者だけが開始できます");
    if (this.phase !== "lobby")
      throw new RoomError("ROOM_ALREADY_STARTED", "ゲームは既に開始しています");
    const connected = [...this.players.values()].filter((player) => player.connected);
    if (connected.length < 2 || connected.some((player) => !player.ready))
      throw new RoomError("NOT_READY", "2人以上の全員が準備完了すると開始できます");
    this.phase = "countdown";
    this.countdownEndsAt = now + 3_000;
  }

  applyInput(
    playerId: string,
    input: { sequence: number; left: boolean; right: boolean; jump: boolean; action?: boolean },
    now = Date.now(),
  ): void {
    const player = this.requirePlayer(playerId);
    if (now - player.inputWindowAt >= 1_000) {
      player.inputWindowAt = now;
      player.inputCount = 0;
    }
    player.inputCount += 1;
    if (player.inputCount > INPUTS_PER_SECOND)
      throw new RoomError("RATE_LIMITED", "入力回数が多すぎます");
    if (input.sequence <= player.lastProcessedInput) return;
    player.lastProcessedInput = input.sequence;
    player.left = input.left;
    player.right = input.right;
    player.jump = input.jump;
    player.action = input.action ?? false;
    if (!input.jump) player.jumpConsumed = false;
  }

  voteRetry(playerId: string, retry: boolean, now = Date.now()): boolean {
    this.requirePlayer(playerId).retry = retry;
    const active = [...this.players.values()].filter((player) => player.connected);
    if (this.phase === "finished" && active.length >= 2 && active.every((player) => player.retry)) {
      this.reset(now);
      return true;
    }
    return false;
  }

  disconnect(playerId: string, now = Date.now()): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = false;
    player.disconnectedAt = now;
    player.left = false;
    player.right = false;
    player.jump = false;
    player.action = false;
    if (this.phase === "playing" && this.players.size === 2) this.pausedAt ??= now;
  }

  remove(playerId: string): void {
    this.players.delete(playerId);
    if (playerId === this.hostPlayerId) this.reassignHost();
  }

  tick(now = Date.now(), deltaSeconds = 0.05): void {
    this.tickNumber += 1;
    this.pruneDisconnected(now);
    if (this.phase === "countdown" && now >= this.countdownEndsAt) {
      this.phase = "playing";
      this.gameStartedAt = now;
    }
    if (this.phase !== "playing") return;

    if (this.players.size === 2 && [...this.players.values()].some((player) => !player.connected))
      return;

    for (const player of this.players.values()) this.simulatePlayer(player, now, deltaSeconds);
    this.resolveRescues(now);
    this.updateGate(now);
    const active = [...this.players.values()].filter((player) => player.connected);
    if (active.length < 2) this.finish("aborted");
    else if (active.every((player) => player.finished)) this.finish("cleared");
    else if (now - this.gameStartedAt >= DIFFICULTY_DURATION_MS[this.difficulty])
      this.finish("timeout");
  }

  roomState(): Extract<ServerMessage, { type: "room_state" }> {
    return {
      version: PROTOCOL_VERSION,
      type: "room_state",
      room: {
        code: this.code,
        phase: this.phase,
        hostPlayerId: this.hostPlayerId,
        stageId: this.stageId,
        difficulty: this.difficulty,
        players: [...this.players.values()].map(this.toSummary),
      },
    };
  }

  snapshot(now = Date.now()): Extract<ServerMessage, { type: "snapshot" }> {
    return {
      version: PROTOCOL_VERSION,
      type: "snapshot",
      tick: this.tickNumber,
      serverTime: now,
      remainingMs: Math.max(
        0,
        DIFFICULTY_DURATION_MS[this.difficulty] -
          Math.max(0, (this.pausedAt ?? now) - this.gameStartedAt),
      ),
      gateOpen: this.gateOpen,
      players: [...this.players.values()].map(this.toSnapshot),
    };
  }

  finishedMessage(now = Date.now()): Extract<ServerMessage, { type: "game_finished" }> | undefined {
    if (!this.result) return undefined;
    return {
      version: PROTOCOL_VERSION,
      type: "game_finished",
      result: this.result,
      elapsedMs: Math.max(0, now - this.gameStartedAt),
    };
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  private addNewPlayer(id: string, name: string, now: number): JoinResult {
    const reconnectToken = randomBytes(24).toString("base64url");
    this.players.set(id, {
      id,
      name,
      ready: false,
      connected: true,
      color: PLAYER_COLORS[this.players.size] ?? "#64748B",
      role: "supporter",
      reconnectToken,
      x: 150 + this.players.size * 70,
      y: 500,
      velocityX: 0,
      velocityY: 0,
      left: false,
      right: false,
      jump: false,
      action: false,
      jumpConsumed: false,
      lastProcessedInput: 0,
      inputWindowAt: now,
      inputCount: 0,
      checkpointX: 150,
      finished: false,
      downed: false,
      rescues: 0,
      retry: false,
    });
    return { playerId: id, reconnectToken };
  }

  private requirePlayer(playerId: string): PlayerState {
    const player = this.players.get(playerId);
    if (!player) throw new RoomError("PLAYER_NOT_FOUND", "プレイヤーが見つかりません");
    return player;
  }

  private simulatePlayer(player: PlayerState, now: number, deltaSeconds: number): void {
    if (!player.connected || player.finished) return;
    if (player.downed) {
      player.velocityX = 0;
      player.velocityY = 0;
      return;
    }
    const moveSpeed = player.role === "runner" ? 310 : 260;
    player.velocityX = player.left === player.right ? 0 : player.left ? -moveSpeed : moveSpeed;
    const grounded = player.y >= 500;
    if (player.jump && grounded && !player.jumpConsumed) {
      player.velocityY = player.role === "jumper" ? -560 : -470;
      player.jumpConsumed = true;
    }
    player.velocityY += 1_050 * deltaSeconds;
    const rules = STAGE_RULES[this.stageId];
    player.x = Math.max(70, Math.min(rules.worldMaxX, player.x + player.velocityX * deltaSeconds));
    player.y += player.velocityY * deltaSeconds;
    const overPit = player.x > rules.pit[0] && player.x < rules.pit[1];
    if (player.y >= 500 && !overPit) {
      player.y = 500;
      player.velocityY = 0;
    }
    if (!this.gateOpen && player.x > rules.gateX) player.x = rules.gateX;
    if (player.x >= rules.checkpointX) player.checkpointX = rules.checkpointX;
    if (player.y > 680) {
      player.downed = true;
      player.downedAt = now;
      player.y = 620;
      player.velocityX = 0;
      player.velocityY = 0;
    }
    if (player.x >= rules.finishX) {
      player.finished = true;
      player.velocityX = 0;
    }
  }

  private resolveRescues(now: number): void {
    const helpers = [...this.players.values()].filter(
      (player) => player.connected && !player.downed && !player.finished && player.action,
    );
    for (const helper of helpers) {
      const radius = helper.role === "supporter" ? 220 : 150;
      const target = [...this.players.values()].find(
        (player) =>
          player !== helper &&
          player.connected &&
          player.downed &&
          Math.abs(player.x - helper.x) <= radius,
      );
      if (target) {
        this.revive(target);
        helper.rescues += 1;
      }
      helper.action = false;
    }
    for (const player of this.players.values()) {
      if (!player.downed || player.downedAt === undefined) continue;
      const baseDelay = AUTO_REVIVE_MS[this.difficulty];
      const autoDelay =
        player.role === "supporter" ? Math.max(2_000, baseDelay - 1_500) : baseDelay;
      if (now - player.downedAt >= autoDelay) this.revive(player);
    }
  }

  private revive(player: PlayerState): void {
    player.downed = false;
    delete player.downedAt;
    player.x = player.checkpointX;
    player.y = 500;
    player.velocityX = 0;
    player.velocityY = 0;
  }

  private updateGate(now: number): void {
    if (this.gateOpen) return;
    const active = [...this.players.values()].filter(
      (player) => player.connected && !player.finished,
    );
    const rules = STAGE_RULES[this.stageId];
    const leftPressed = active.some((player) => Math.abs(player.x - rules.switches[0]) <= 60);
    const rightPressed = active.some((player) => Math.abs(player.x - rules.switches[1]) <= 60);
    if (leftPressed && rightPressed) {
      this.switchHeldSince ??= now;
      if (now - this.switchHeldSince >= 1_000) this.gateOpen = true;
    } else this.switchHeldSince = undefined;
  }

  private pruneDisconnected(now: number): void {
    let hostWasRemoved = false;
    for (const player of this.players.values()) {
      if (
        !player.connected &&
        player.disconnectedAt !== undefined &&
        now - player.disconnectedAt > RECONNECT_GRACE_MS
      ) {
        this.players.delete(player.id);
        hostWasRemoved ||= player.id === this.hostPlayerId;
      }
    }
    if (hostWasRemoved) this.reassignHost();
  }

  private reassignHost(): void {
    const nextHost =
      [...this.players.values()].find((player) => player.connected) ??
      this.players.values().next().value;
    if (nextHost) this.hostPlayerId = nextHost.id;
  }

  private finish(result: "aborted" | "cleared" | "timeout"): void {
    this.phase = "finished";
    this.result = result;
  }

  private reset(now: number): void {
    this.phase = "countdown";
    this.countdownEndsAt = now + 3_000;
    this.gameStartedAt = 0;
    this.gateOpen = false;
    this.result = undefined;
    this.switchHeldSince = undefined;
    this.pausedAt = undefined;
    for (const player of this.players.values())
      Object.assign(player, {
        ready: true,
        x: 150,
        y: 500,
        velocityX: 0,
        velocityY: 0,
        finished: false,
        downed: false,
        downedAt: undefined,
        action: false,
        retry: false,
        checkpointX: 150,
      });
  }

  private readonly toSummary = (player: PlayerState): PlayerSummary => ({
    id: player.id,
    name: player.name,
    ready: player.ready,
    connected: player.connected,
    color: player.color,
    role: player.role,
  });
  private readonly toSnapshot = (player: PlayerState): PlayerSnapshot => ({
    id: player.id,
    x: player.x,
    y: player.y,
    velocityX: player.velocityX,
    velocityY: player.velocityY,
    lastProcessedInput: player.lastProcessedInput,
    finished: player.finished,
    downed: player.downed,
  });
}
