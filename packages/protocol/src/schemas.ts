export const PROTOCOL_VERSION = 3 as const;
export const MAX_PLAYERS = 6 as const;

export const PLAYER_ROLES = ["runner", "jumper", "supporter"] as const;
export type PlayerRole = (typeof PLAYER_ROLES)[number];
export const STAGE_IDS = ["school-gate", "rooftop-relay", "gym-escape"] as const;
export type StageId = (typeof STAGE_IDS)[number];
export const DIFFICULTY_LEVELS = ["casual", "standard", "challenge"] as const;
export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];

interface Envelope {
  version: typeof PROTOCOL_VERSION;
  requestId?: string;
}

export interface PlayerSummary {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  color: string;
  role: PlayerRole;
}

export interface PlayerSnapshot {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lastProcessedInput: number;
  finished: boolean;
  downed: boolean;
}

export type ClientMessage =
  | (Envelope & { type: "create_room"; player: { id: string; name: string } })
  | (Envelope & {
      type: "join_room";
      roomCode: string;
      player: { id: string; name: string };
      reconnectToken?: string;
    })
  | (Envelope & { type: "set_ready"; ready: boolean })
  | (Envelope & { type: "set_role"; role: PlayerRole })
  | (Envelope & { type: "set_game_options"; stageId: StageId; difficulty: Difficulty })
  | (Envelope & { type: "start_game" })
  | (Envelope & { type: "leave_room" })
  | (Envelope & {
      type: "input";
      sequence: number;
      left: boolean;
      right: boolean;
      jump: boolean;
      action: boolean;
    })
  | (Envelope & { type: "retry_vote"; retry: boolean })
  | (Envelope & { type: "ping"; sentAt: number });

export type ProtocolErrorCode =
  | "INVALID_MESSAGE"
  | "PROTOCOL_VERSION_MISMATCH"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_ALREADY_STARTED"
  | "NOT_HOST"
  | "NOT_READY"
  | "DUPLICATE_PLAYER"
  | "RECONNECT_TOKEN_INVALID"
  | "PLAYER_NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type ServerMessage =
  | (Envelope & {
      type: "session_established";
      roomCode: string;
      playerId: string;
      reconnectToken: string;
    })
  | (Envelope & {
      type: "room_state";
      room: {
        code: string;
        phase: "lobby" | "countdown" | "playing" | "finished";
        hostPlayerId: string;
        stageId: StageId;
        difficulty: Difficulty;
        players: PlayerSummary[];
      };
    })
  | (Envelope & { type: "game_started"; stageId: StageId; startedAt: number })
  | (Envelope & {
      type: "snapshot";
      tick: number;
      serverTime: number;
      remainingMs: number;
      gateOpen: boolean;
      players: PlayerSnapshot[];
    })
  | (Envelope & { type: "game_event"; event: Record<string, unknown> })
  | (Envelope & {
      type: "game_finished";
      result: "cleared" | "timeout" | "aborted";
      elapsedMs: number;
    })
  | (Envelope & { type: "pong"; sentAt: number; serverTime: number })
  | (Envelope & {
      type: "error";
      code: ProtocolErrorCode;
      message?: string;
      supportedVersion?: number;
    });

export interface RuntimeSchema<T> {
  safeParse(
    input: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isString = (value: unknown, max = 64): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const isInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isRoomCode = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z0-9]{4,6}$/.test(value);
const hasEnvelope = (value: Record<string, unknown>): boolean =>
  value.version === PROTOCOL_VERSION &&
  (value.requestId === undefined || isString(value.requestId));

function schema<T>(guard: (input: unknown) => input is T): RuntimeSchema<T> {
  return {
    safeParse(input) {
      return guard(input)
        ? { success: true, data: input }
        : {
            success: false,
            error: { issues: [{ message: "Message does not match the shared protocol" }] },
          };
    },
  };
}

function isPlayerSummary(value: unknown): value is PlayerSummary {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name, 24) &&
    typeof value.ready === "boolean" &&
    typeof value.connected === "boolean" &&
    typeof value.color === "string" &&
    /^#[0-9A-F]{6}$/i.test(value.color) &&
    isPlayerRole(value.role)
  );
}

function isPlayerSnapshot(value: unknown): value is PlayerSnapshot {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.velocityX) &&
    isFiniteNumber(value.velocityY) &&
    isInteger(value.lastProcessedInput) &&
    typeof value.finished === "boolean" &&
    typeof value.downed === "boolean"
  );
}

function isClientMessage(input: unknown): input is ClientMessage {
  if (!isRecord(input) || !hasEnvelope(input)) return false;
  switch (input.type) {
    case "create_room":
      return isRecord(input.player) && isString(input.player.id) && isString(input.player.name, 24);
    case "join_room":
      return (
        isRoomCode(input.roomCode) &&
        isRecord(input.player) &&
        isString(input.player.id) &&
        isString(input.player.name, 24) &&
        (input.reconnectToken === undefined ||
          (isString(input.reconnectToken, 256) && input.reconnectToken.length >= 16))
      );
    case "set_ready":
      return typeof input.ready === "boolean";
    case "set_role":
      return isPlayerRole(input.role);
    case "set_game_options":
      return isStageId(input.stageId) && isDifficulty(input.difficulty);
    case "start_game":
    case "leave_room":
      return true;
    case "input":
      return (
        isInteger(input.sequence) &&
        typeof input.left === "boolean" &&
        typeof input.right === "boolean" &&
        typeof input.jump === "boolean" &&
        typeof input.action === "boolean"
      );
    case "retry_vote":
      return typeof input.retry === "boolean";
    case "ping":
      return isInteger(input.sentAt);
    default:
      return false;
  }
}

function isServerMessage(input: unknown): input is ServerMessage {
  if (!isRecord(input) || !hasEnvelope(input)) return false;
  switch (input.type) {
    case "session_established":
      return (
        isRoomCode(input.roomCode) &&
        isString(input.playerId) &&
        isString(input.reconnectToken, 256) &&
        input.reconnectToken.length >= 16
      );
    case "room_state":
      return (
        isRecord(input.room) &&
        isRoomCode(input.room.code) &&
        ["lobby", "countdown", "playing", "finished"].includes(String(input.room.phase)) &&
        isString(input.room.hostPlayerId) &&
        isStageId(input.room.stageId) &&
        isDifficulty(input.room.difficulty) &&
        Array.isArray(input.room.players) &&
        input.room.players.length >= 1 &&
        input.room.players.length <= MAX_PLAYERS &&
        input.room.players.every(isPlayerSummary)
      );
    case "game_started":
      return isStageId(input.stageId) && isInteger(input.startedAt);
    case "snapshot":
      return (
        isInteger(input.tick) &&
        isInteger(input.serverTime) &&
        isInteger(input.remainingMs) &&
        typeof input.gateOpen === "boolean" &&
        Array.isArray(input.players) &&
        input.players.length <= MAX_PLAYERS &&
        input.players.every(isPlayerSnapshot)
      );
    case "game_event":
      return isRecord(input.event) && isString(input.event.kind);
    case "game_finished":
      return (
        ["cleared", "timeout", "aborted"].includes(String(input.result)) &&
        isInteger(input.elapsedMs)
      );
    case "pong":
      return isInteger(input.sentAt) && isInteger(input.serverTime);
    case "error":
      return (
        isString(input.code) &&
        (input.message === undefined || isString(input.message, 200)) &&
        (input.supportedVersion === undefined || isInteger(input.supportedVersion))
      );
    default:
      return false;
  }
}

export const clientMessageSchema = schema<ClientMessage>(isClientMessage);
export const serverMessageSchema = schema<ServerMessage>(isServerMessage);
const isPlayerRole = (value: unknown): value is PlayerRole =>
  typeof value === "string" && PLAYER_ROLES.includes(value as PlayerRole);
const isStageId = (value: unknown): value is StageId =>
  typeof value === "string" && STAGE_IDS.includes(value as StageId);
const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === "string" && DIFFICULTY_LEVELS.includes(value as Difficulty);
