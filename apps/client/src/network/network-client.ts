import {
  parseServerMessage,
  PROTOCOL_VERSION,
  type ClientMessage,
  type Difficulty,
  type PlayerRole,
  type ServerMessage,
  type StageId,
} from "../../../../packages/protocol/src";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";
type MessageListener = (message: ServerMessage) => void;
type StateListener = (state: ConnectionState) => void;

interface SavedSession {
  name: string;
  playerId: string;
  reconnectToken: string;
  roomCode: string;
}

const sessionKey = "houkago-dash-session";
const accessKeyStorageKey = "houkago-dash-friend-key";

function defaultServerUrl(): string {
  const selected = new URLSearchParams(globalThis.location?.search ?? "").get("server");
  if (selected) return selected;
  const configured = import.meta.env.VITE_GAME_SERVER_URL?.trim();
  if (configured) return configured;
  const scheme = globalThis.location?.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${globalThis.location?.hostname ?? "127.0.0.1"}:8787`;
}

export class NetworkClient {
  private readonly messageListeners = new Set<MessageListener>();
  private readonly stateListeners = new Set<StateListener>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private saved: SavedSession | undefined;
  private socket: WebSocket | undefined;
  private state: ConnectionState = "disconnected";
  private latestRoom: Extract<ServerMessage, { type: "room_state" }> | undefined;
  private url = defaultServerUrl();
  private accessKey = "";

  constructor() {
    this.saved = this.loadSession();
    const invitedKey = new URLSearchParams(globalThis.location?.search ?? "").get("friend");
    this.accessKey = invitedKey?.trim() || localStorage.getItem(accessKeyStorageKey) || "";
    if (this.accessKey) localStorage.setItem(accessKeyStorageKey, this.accessKey);
    globalThis.document?.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.state === "disconnected" && this.saved)
        void this.connect(true);
    });
  }

  get connectionState(): ConnectionState {
    return this.state;
  }
  get roomState(): Extract<ServerMessage, { type: "room_state" }> | undefined {
    return this.latestRoom;
  }
  get session(): SavedSession | undefined {
    return this.saved;
  }
  get friendAccessKey(): string {
    return this.accessKey;
  }

  setFriendAccessKey(value: string): void {
    this.accessKey = value.trim();
    if (this.accessKey) localStorage.setItem(accessKeyStorageKey, this.accessKey);
    else localStorage.removeItem(accessKeyStorageKey);
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }
  onState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  async connect(reconnecting = false): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    this.setState(reconnecting ? "reconnecting" : "connecting");
    await new Promise<void>((resolve, reject) => {
      const url = new URL(this.url);
      if (this.accessKey) url.searchParams.set("access_key", this.accessKey);
      const socket = new WebSocket(url);
      this.socket = socket;
      socket.addEventListener(
        "open",
        () => {
          this.reconnectAttempts = 0;
          this.setState("connected");
          if (reconnecting && this.saved)
            this.send({
              version: PROTOCOL_VERSION,
              type: "join_room",
              roomCode: this.saved.roomCode,
              player: { id: this.saved.playerId, name: this.saved.name },
              reconnectToken: this.saved.reconnectToken,
            });
          resolve();
        },
        { once: true },
      );
      socket.addEventListener("message", (event) => this.receive(event.data));
      socket.addEventListener("close", () => this.handleClose());
      socket.addEventListener(
        "error",
        () => {
          if (this.state === "connecting") reject(new Error("ゲームサーバーへ接続できません"));
        },
        { once: true },
      );
    });
  }

  async createRoom(name: string): Promise<void> {
    await this.connectWithWakeUp();
    const playerId = crypto.randomUUID();
    this.saved = { playerId, name, roomCode: "", reconnectToken: "" };
    this.send({ version: PROTOCOL_VERSION, type: "create_room", player: { id: playerId, name } });
  }

  async joinRoom(roomCode: string, name: string): Promise<void> {
    await this.connectWithWakeUp();
    const playerId = crypto.randomUUID();
    this.saved = { playerId, name, roomCode: roomCode.toUpperCase(), reconnectToken: "" };
    this.send({
      version: PROTOCOL_VERSION,
      type: "join_room",
      roomCode: roomCode.toUpperCase(),
      player: { id: playerId, name },
    });
  }

  setReady(ready: boolean): void {
    this.send({ version: PROTOCOL_VERSION, type: "set_ready", ready });
  }
  setRole(role: PlayerRole): void {
    this.send({ version: PROTOCOL_VERSION, type: "set_role", role });
  }
  setGameOptions(stageId: StageId, difficulty: Difficulty): void {
    this.send({ version: PROTOCOL_VERSION, type: "set_game_options", stageId, difficulty });
  }
  startGame(): void {
    this.send({ version: PROTOCOL_VERSION, type: "start_game" });
  }
  sendInput(sequence: number, left: boolean, right: boolean, jump: boolean, action: boolean): void {
    this.send({ version: PROTOCOL_VERSION, type: "input", sequence, left, right, jump, action });
  }
  voteRetry(retry: boolean): void {
    this.send({ version: PROTOCOL_VERSION, type: "retry_vote", retry });
  }
  leave(): void {
    this.send({ version: PROTOCOL_VERSION, type: "leave_room" });
    this.clearSession();
  }

  private async connectWithWakeUp(): Promise<void> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        await this.connect();
        return;
      } catch {
        this.socket?.close();
        this.socket = undefined;
        this.setState("disconnected");
        if (attempt === 7)
          throw new Error("無料サーバーを起動できませんでした。少し待って、もう一度お試しください");
        await new Promise((resolve) => setTimeout(resolve, 10_000));
      }
    }
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }

  private receive(raw: unknown): void {
    if (typeof raw !== "string") return;
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return;
    }
    const parsed = parseServerMessage(input);
    if (!parsed.success) return;
    if (parsed.data.type === "session_established" && this.saved) {
      this.saved = {
        ...this.saved,
        roomCode: parsed.data.roomCode,
        playerId: parsed.data.playerId,
        reconnectToken: parsed.data.reconnectToken,
      };
      localStorage.setItem(sessionKey, JSON.stringify(this.saved));
    }
    if (parsed.data.type === "room_state") this.latestRoom = parsed.data;
    for (const listener of this.messageListeners) listener(parsed.data);
  }

  private handleClose(): void {
    this.socket = undefined;
    if (!this.saved?.reconnectToken) {
      this.setState("disconnected");
      return;
    }
    this.setState("reconnecting");
    const delay = Math.min(5_000, 500 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      void this.connect(true).catch(() => this.handleClose());
    }, delay);
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    for (const listener of this.stateListeners) listener(state);
  }
  private clearSession(): void {
    this.saved = undefined;
    localStorage.removeItem(sessionKey);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }
  private loadSession(): SavedSession | undefined {
    try {
      const value = localStorage.getItem(sessionKey);
      return value ? (JSON.parse(value) as SavedSession) : undefined;
    } catch {
      return undefined;
    }
  }
}

export const networkClient = new NetworkClient();
