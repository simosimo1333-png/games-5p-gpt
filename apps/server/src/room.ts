import { randomBytes } from "node:crypto";

import {
  MAX_PLAYERS,
  PROTOCOL_VERSION,
  type PlayerSnapshot,
  type PlayerSummary,
  type ServerMessage,
} from "../../../packages/protocol/src";

const PLAYER_COLORS = ["#EF4444", "#3B82F6", "#22C55E", "#EAB308", "#A855F7", "#F97316"] as const;
const RECONNECT_GRACE_MS = 30_000;
const GAME_DURATION_MS = 180_000;
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
  reconnectToken: string;
  disconnectedAt?: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpConsumed: boolean;
  lastProcessedInput: number;
  inputWindowAt: number;
  inputCount: number;
  checkpointX: number;
  finished: boolean;
  retry: boolean;
}

export interface JoinResult {
  playerId: string;
  reconnectToken: string;
}

export class Room {
  readonly players = new Map<string, PlayerState>();
  phase: RoomPhase = "lobby";
  gateOpen = false;
  tickNumber = 0;
  private countdownEndsAt = 0;
  private gameStartedAt = 0;
  private pausedAt: number | undefined;
  private switchHeldSince: number | undefined;
  private result: "aborted" | "cleared" | "timeout" | undefined;

  constructor(
    readonly code: string,
    readonly hostPlayerId: string,
    hostName: string,
    now = Date.now(),
  ) {
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
    input: { sequence: number; left: boolean; right: boolean; jump: boolean },
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
    if (this.phase === "playing" && this.players.size === 2) this.pausedAt ??= now;
  }

  remove(playerId: string): void {
    this.players.delete(playerId);
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

    for (const player of this.players.values()) this.simulatePlayer(player, deltaSeconds);
    this.updateGate(now);
    const active = [...this.players.values()].filter((player) => player.connected);
    if (active.length < 2) this.finish("aborted");
    else if (active.every((player) => player.finished)) this.finish("cleared");
    else if (now - this.gameStartedAt >= GAME_DURATION_MS) this.finish("timeout");
  }

  roomState(): Extract<ServerMessage, { type: "room_state" }> {
    return {
      version: PROTOCOL_VERSION,
      type: "room_state",
      room: {
        code: this.code,
        phase: this.phase,
        hostPlayerId: this.hostPlayerId,
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
        GAME_DURATION_MS - Math.max(0, (this.pausedAt ?? now) - this.gameStartedAt),
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
      reconnectToken,
      x: 150 + this.players.size * 70,
      y: 500,
      velocityX: 0,
      velocityY: 0,
      left: false,
      right: false,
      jump: false,
      jumpConsumed: false,
      lastProcessedInput: 0,
      inputWindowAt: now,
      inputCount: 0,
      checkpointX: 150,
      finished: false,
      retry: false,
    });
    return { playerId: id, reconnectToken };
  }

  private requirePlayer(playerId: string): PlayerState {
    const player = this.players.get(playerId);
    if (!player) throw new RoomError("PLAYER_NOT_FOUND", "プレイヤーが見つかりません");
    return player;
  }

  private simulatePlayer(player: PlayerState, deltaSeconds: number): void {
    if (!player.connected || player.finished) return;
    player.velocityX = player.left === player.right ? 0 : player.left ? -260 : 260;
    const grounded = player.y >= 500;
    if (player.jump && grounded && !player.jumpConsumed) {
      player.velocityY = -470;
      player.jumpConsumed = true;
    }
    player.velocityY += 1_050 * deltaSeconds;
    player.x = Math.max(70, Math.min(3_080, player.x + player.velocityX * deltaSeconds));
    player.y += player.velocityY * deltaSeconds;
    const overPit = player.x > 2_180 && player.x < 2_360;
    if (player.y >= 500 && !overPit) {
      player.y = 500;
      player.velocityY = 0;
    }
    if (!this.gateOpen && player.x > 1_520) player.x = 1_520;
    if (player.x >= 1_900) player.checkpointX = 1_900;
    if (player.y > 680) {
      player.x = player.checkpointX;
      player.y = 500;
      player.velocityX = 0;
      player.velocityY = 0;
    }
    if (player.x >= 2_820) {
      player.finished = true;
      player.velocityX = 0;
    }
  }

  private updateGate(now: number): void {
    if (this.gateOpen) return;
    const active = [...this.players.values()].filter(
      (player) => player.connected && !player.finished,
    );
    const leftPressed = active.some((player) => Math.abs(player.x - 1_250) <= 60);
    const rightPressed = active.some((player) => Math.abs(player.x - 1_430) <= 60);
    if (leftPressed && rightPressed) {
      this.switchHeldSince ??= now;
      if (now - this.switchHeldSince >= 1_000) this.gateOpen = true;
    } else this.switchHeldSince = undefined;
  }

  private pruneDisconnected(now: number): void {
    for (const player of this.players.values()) {
      if (
        !player.connected &&
        player.disconnectedAt !== undefined &&
        now - player.disconnectedAt > RECONNECT_GRACE_MS
      )
        this.players.delete(player.id);
    }
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
  });
  private readonly toSnapshot = (player: PlayerState): PlayerSnapshot => ({
    id: player.id,
    x: player.x,
    y: player.y,
    velocityX: player.velocityX,
    velocityY: player.velocityY,
    lastProcessedInput: player.lastProcessedInput,
    finished: player.finished,
  });
}
