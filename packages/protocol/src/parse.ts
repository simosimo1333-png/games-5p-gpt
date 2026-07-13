import {
  clientMessageSchema,
  PROTOCOL_VERSION,
  serverMessageSchema,
  type ClientMessage,
  type RuntimeSchema,
  type ServerMessage,
} from "./schemas";

export interface ParseFailure {
  readonly success: false;
  readonly error: Extract<ServerMessage, { type: "error" }>;
}

export interface ParseSuccess<T> {
  readonly success: true;
  readonly data: T;
}

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

function readVersion(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return undefined;
  return Reflect.get(input, "version");
}

function parseWith<T>(schema: RuntimeSchema<T>, input: unknown): ParseResult<T> {
  if (readVersion(input) !== PROTOCOL_VERSION) {
    return {
      success: false,
      error: {
        version: PROTOCOL_VERSION,
        type: "error",
        code: "PROTOCOL_VERSION_MISMATCH",
        supportedVersion: PROTOCOL_VERSION,
      },
    };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        version: PROTOCOL_VERSION,
        type: "error",
        code: "INVALID_MESSAGE",
        message: parsed.error.issues[0]?.message ?? "Invalid message",
      },
    };
  }
  return { success: true, data: parsed.data };
}

export function parseClientMessage(input: unknown): ParseResult<ClientMessage> {
  return parseWith(clientMessageSchema, input);
}

export function parseServerMessage(input: unknown): ParseResult<ServerMessage> {
  return parseWith(serverMessageSchema, input);
}
