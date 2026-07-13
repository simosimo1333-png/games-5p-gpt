import WebSocket from "ws";
import { afterEach, describe, expect, it } from "vitest";

import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
} from "../../../packages/protocol/src";
import { GameServer } from "./game-server";

class TestClient {
  private readonly messages: ServerMessage[] = [];
  private readonly socket: WebSocket;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.on("message", (data) =>
      this.messages.push(JSON.parse(data.toString()) as ServerMessage),
    );
  }

  static async connect(port: number): Promise<TestClient> {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    return new TestClient(socket);
  }

  send(message: ClientMessage): void {
    this.socket.send(JSON.stringify(message));
  }
  close(): void {
    this.socket.close();
  }
  async waitFor<T extends ServerMessage["type"]>(
    type: T,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const index = this.messages.findIndex((message) => message.type === type);
      if (index >= 0)
        return this.messages.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for ${type}`);
  }
}

describe("websocket game server", () => {
  const servers: GameServer[] = [];
  const clients: TestClient[] = [];
  afterEach(async () => {
    for (const client of clients) client.close();
    clients.length = 0;
    for (const server of servers) await server.close();
    servers.length = 0;
  });

  it("creates a room, joins a second client, and starts together", async () => {
    const server = new GameServer({ port: 0 });
    servers.push(server);
    const host = await TestClient.connect(server.address());
    const guest = await TestClient.connect(server.address());
    clients.push(host, guest);
    host.send({
      version: PROTOCOL_VERSION,
      type: "create_room",
      player: { id: "host", name: "Host" },
    });
    const hostSession = await host.waitFor("session_established");
    guest.send({
      version: PROTOCOL_VERSION,
      type: "join_room",
      roomCode: hostSession.roomCode,
      player: { id: "guest", name: "Guest" },
    });
    await guest.waitFor("session_established");
    host.send({ version: PROTOCOL_VERSION, type: "set_ready", ready: true });
    guest.send({ version: PROTOCOL_VERSION, type: "set_ready", ready: true });
    await new Promise((resolve) => setTimeout(resolve, 30));
    host.send({ version: PROTOCOL_VERSION, type: "start_game" });
    await expect(host.waitFor("game_started")).resolves.toMatchObject({ stageId: "school-gate" });
    await expect(guest.waitFor("game_started")).resolves.toMatchObject({ stageId: "school-gate" });
    host.send({
      version: PROTOCOL_VERSION,
      type: "input",
      sequence: 1,
      left: false,
      right: true,
      jump: true,
    });
    let processed = 0;
    for (let attempt = 0; attempt < 10 && processed < 1; attempt += 1) {
      const moved = await guest.waitFor("snapshot");
      processed = moved.players.find((player) => player.id === "host")?.lastProcessedInput ?? 0;
    }
    expect(processed).toBe(1);
  });

  it("rejects an unknown room with a stable error", async () => {
    const server = new GameServer({ port: 0 });
    servers.push(server);
    const client = await TestClient.connect(server.address());
    clients.push(client);
    client.send({
      version: PROTOCOL_VERSION,
      type: "join_room",
      roomCode: "ZZZZZ",
      player: { id: "guest", name: "Guest" },
    });
    await expect(client.waitFor("error")).resolves.toMatchObject({ code: "ROOM_NOT_FOUND" });
  });

  it("exposes health and privacy-safe operational metrics", async () => {
    const server = new GameServer({ port: 0 });
    servers.push(server);
    const client = await TestClient.connect(server.address());
    clients.push(client);
    const health = (await fetch(`http://127.0.0.1:${server.address()}/health`).then((response) =>
      response.json(),
    )) as { ok: boolean };
    const metrics = (await fetch(`http://127.0.0.1:${server.address()}/metrics`).then((response) =>
      response.json(),
    )) as Record<string, unknown>;
    expect(health.ok).toBe(true);
    expect(metrics).toMatchObject({ activeConnections: 1, connectionsTotal: 1, activeRooms: 0 });
    expect(JSON.stringify(metrics)).not.toMatch(/token|name/i);
  });

  it("restores the same player through a websocket reconnection", async () => {
    const server = new GameServer({ port: 0 });
    servers.push(server);
    const original = await TestClient.connect(server.address());
    clients.push(original);
    original.send({
      version: PROTOCOL_VERSION,
      type: "create_room",
      player: { id: "host", name: "Host" },
    });
    const session = await original.waitFor("session_established");
    original.close();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const restored = await TestClient.connect(server.address());
    clients.push(restored);
    restored.send({
      version: PROTOCOL_VERSION,
      type: "join_room",
      roomCode: session.roomCode,
      player: { id: "host", name: "Host" },
      reconnectToken: session.reconnectToken,
    });
    await expect(restored.waitFor("session_established")).resolves.toMatchObject({
      playerId: "host",
      reconnectToken: session.reconnectToken,
    });
    expect(server.metrics.reconnectsTotal).toBe(1);
  });
});
