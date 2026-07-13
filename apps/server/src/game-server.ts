import { randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";

import WebSocket, { WebSocketServer } from "ws";

import {
  parseClientMessage,
  PROTOCOL_VERSION,
  type ServerMessage,
} from "../../../packages/protocol/src";
import { logger, type Logger } from "./logger";
import { Metrics } from "./metrics";
import { RoomError, type Room } from "./room";
import { RoomManager } from "./room-manager";

interface ClientSession {
  correlationId: string;
  playerId: string | undefined;
  room: Room | undefined;
}

export interface GameServerOptions {
  logger?: Logger;
  port?: number;
}

export class GameServer {
  readonly rooms = new RoomManager();
  readonly metrics = new Metrics();
  private readonly httpServer: HttpServer;
  private readonly sessions = new Map<WebSocket, ClientSession>();
  private readonly socketsByPlayer = new Map<string, WebSocket>();
  private readonly wss: WebSocketServer;
  private readonly log: Logger;
  private tickTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: GameServerOptions = {}) {
    this.log = options.logger ?? logger;
    this.httpServer = createServer((request, response) => {
      if (request.url === "/health" || request.url === "/metrics") {
        response.writeHead(200, { "content-type": "application/json" });
        const metrics = this.metrics.snapshot(this.rooms.rooms.size);
        response.end(
          JSON.stringify(
            request.url === "/health" ? { ok: true, rooms: metrics.activeRooms } : metrics,
          ),
        );
        return;
      }
      response.writeHead(404).end();
    });
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.wss.on("connection", (socket) => this.onConnection(socket));
    this.httpServer.listen(options.port ?? 8787);
    this.tickTimer = setInterval(() => this.tick(), 50);
  }

  async close(): Promise<void> {
    if (this.tickTimer) clearInterval(this.tickTimer);
    for (const socket of this.sessions.keys()) socket.close();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    await new Promise<void>((resolve, reject) =>
      this.httpServer.close((error) => (error ? reject(error) : resolve())),
    );
  }

  address(): number {
    const address = this.httpServer.address();
    return typeof address === "object" && address ? address.port : 0;
  }

  private onConnection(socket: WebSocket): void {
    const session: ClientSession = {
      correlationId: randomUUID(),
      playerId: undefined,
      room: undefined,
    };
    this.sessions.set(socket, session);
    this.metrics.activeConnections += 1;
    this.metrics.connectionsTotal += 1;
    this.log.info({ event: "connection.opened", correlationId: session.correlationId });
    socket.on("message", (data) => this.onMessage(socket, data.toString()));
    socket.on("close", () => this.onClose(socket));
    socket.on("error", () => this.onClose(socket));
  }

  private onMessage(socket: WebSocket, raw: string): void {
    const session = this.sessions.get(socket);
    if (!session) return;
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      this.metrics.errorsTotal += 1;
      this.sendError(socket, "INVALID_MESSAGE", "JSON形式が正しくありません");
      return;
    }
    const parsed = parseClientMessage(input);
    if (!parsed.success) {
      this.metrics.errorsTotal += 1;
      this.send(socket, parsed.error);
      return;
    }
    try {
      const message = parsed.data;
      switch (message.type) {
        case "create_room": {
          const room = this.rooms.create(message.player.id, message.player.name);
          const player = room.players.get(message.player.id);
          if (!player) throw new RoomError("INTERNAL_ERROR", "プレイヤーを作成できませんでした");
          this.establish(socket, session, room, message.player.id, player.reconnectToken);
          break;
        }
        case "join_room": {
          const room = this.rooms.get(message.roomCode);
          const joined = room.join(
            message.player.id,
            message.player.name,
            Date.now(),
            message.reconnectToken,
          );
          if (message.reconnectToken) this.metrics.reconnectsTotal += 1;
          this.establish(socket, session, room, joined.playerId, joined.reconnectToken);
          break;
        }
        case "set_ready":
          this.withRoom(session).setReady(this.withPlayer(session), message.ready);
          this.broadcastRoom(this.withRoom(session));
          break;
        case "start_game":
          this.withRoom(session).start(this.withPlayer(session));
          this.broadcastRoom(this.withRoom(session));
          break;
        case "input":
          this.withRoom(session).applyInput(this.withPlayer(session), message);
          break;
        case "retry_vote":
          this.withRoom(session).voteRetry(this.withPlayer(session), message.retry);
          this.broadcastRoom(this.withRoom(session));
          break;
        case "leave_room":
          this.leave(socket, session);
          break;
        case "ping":
          this.send(socket, {
            version: PROTOCOL_VERSION,
            type: "pong",
            sentAt: message.sentAt,
            serverTime: Date.now(),
          });
          break;
      }
    } catch (error) {
      this.metrics.errorsTotal += 1;
      if (error instanceof RoomError) this.sendError(socket, error.code, error.message);
      else {
        this.log.error({
          event: "message.failed",
          correlationId: session.correlationId,
          roomCode: session.room?.code,
          playerId: session.playerId,
        });
        this.sendError(socket, "INTERNAL_ERROR", "サーバーで問題が発生しました");
      }
    }
  }

  private tick(): void {
    const tickStartedAt = performance.now();
    const now = Date.now();
    for (const room of this.rooms.rooms.values()) {
      const previous = room.phase;
      room.tick(now);
      if (previous !== room.phase) {
        this.broadcastRoom(room);
        if (room.phase === "playing")
          this.broadcast(room, {
            version: PROTOCOL_VERSION,
            type: "game_started",
            stageId: "school-gate",
            startedAt: now,
          });
        if (room.phase === "finished") {
          const message = room.finishedMessage(now);
          if (message) this.broadcast(room, message);
        }
        this.log.info({
          event: `game.${room.phase}`,
          roomCode: room.code,
          playerCount: room.players.size,
        });
      }
      if (room.phase === "playing") this.broadcast(room, room.snapshot(now));
      this.rooms.deleteIfEmpty(room);
    }
    this.metrics.tickDurationMaxMs = Math.max(
      this.metrics.tickDurationMaxMs,
      performance.now() - tickStartedAt,
    );
  }

  private establish(
    socket: WebSocket,
    session: ClientSession,
    room: Room,
    playerId: string,
    reconnectToken: string,
  ): void {
    const previous = this.socketsByPlayer.get(playerId);
    if (previous && previous !== socket) this.metrics.reconnectsTotal += 1;
    if (previous && previous !== socket) previous.close(4001, "reconnected");
    session.room = room;
    session.playerId = playerId;
    this.socketsByPlayer.set(playerId, socket);
    this.send(socket, {
      version: PROTOCOL_VERSION,
      type: "session_established",
      roomCode: room.code,
      playerId,
      reconnectToken,
    });
    this.broadcastRoom(room);
    this.log.info({
      event: "room.joined",
      correlationId: session.correlationId,
      roomCode: room.code,
      playerId,
      playerCount: room.players.size,
    });
  }

  private leave(socket: WebSocket, session: ClientSession): void {
    if (session.room && session.playerId) {
      session.room.remove(session.playerId);
      this.socketsByPlayer.delete(session.playerId);
      this.broadcastRoom(session.room);
      this.rooms.deleteIfEmpty(session.room);
    }
    session.room = undefined;
    session.playerId = undefined;
    socket.close(1000, "left room");
  }

  private onClose(socket: WebSocket): void {
    const session = this.sessions.get(socket);
    if (!session) return;
    if (session.room && session.playerId && this.socketsByPlayer.get(session.playerId) === socket) {
      session.room.disconnect(session.playerId);
      this.socketsByPlayer.delete(session.playerId);
      this.broadcastRoom(session.room);
      this.log.warn({
        event: "connection.lost",
        correlationId: session.correlationId,
        roomCode: session.room.code,
        playerId: session.playerId,
      });
    }
    this.sessions.delete(socket);
    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
    this.metrics.disconnectsTotal += 1;
  }

  private broadcastRoom(room: Room): void {
    this.broadcast(room, room.roomState());
  }
  private broadcast(room: Room, message: ServerMessage): void {
    for (const [socket, session] of this.sessions)
      if (session.room === room) this.send(socket, message);
  }
  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
  private sendError(
    socket: WebSocket,
    code: Extract<ServerMessage, { type: "error" }>["code"],
    message: string,
  ): void {
    this.send(socket, { version: PROTOCOL_VERSION, type: "error", code, message });
  }
  private withRoom(session: ClientSession): Room {
    if (!session.room) throw new RoomError("ROOM_NOT_FOUND", "先にルームへ参加してください");
    return session.room;
  }
  private withPlayer(session: ClientSession): string {
    if (!session.playerId) throw new RoomError("PLAYER_NOT_FOUND", "プレイヤーが見つかりません");
    return session.playerId;
  }
}
