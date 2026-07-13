import Phaser from "phaser";

import { networkClient, type ConnectionState } from "../network/network-client";
import { GAME_WIDTH } from "../config/game";
import type { PlayerSummary, ServerMessage } from "../../../../packages/protocol/src";

export class LobbyScene extends Phaser.Scene {
  private cleanup: Array<() => void> = [];
  private panel: HTMLDivElement | undefined;
  private roomCode = "";

  constructor() {
    super("lobby");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#8fd3ff");
    this.add
      .text(GAME_WIDTH / 2, 100, "放課後ダッシュ！", {
        fontFamily: "system-ui",
        fontSize: "64px",
        fontStyle: "bold",
        color: "#0f172a",
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 170, "2〜6人で校門を目指そう", {
        fontFamily: "system-ui",
        fontSize: "28px",
        color: "#334155",
      })
      .setOrigin(0.5);
    this.createPanel();
    this.cleanup.push(networkClient.onMessage((message) => this.onMessage(message)));
    this.cleanup.push(networkClient.onState((state) => this.showConnection(state)));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyPanel());
    if (networkClient.session?.reconnectToken)
      void networkClient
        .connect(true)
        .catch(() => this.showError("前回のルームへ再接続できませんでした"));
  }

  private createPanel(): void {
    const invitedRoom = new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "";
    const panel = document.createElement("div");
    panel.id = "lobby-panel";
    panel.className = "lobby-panel";
    panel.innerHTML = `<label>表示名<input id="player-name" maxlength="24" autocomplete="nickname" value="${this.escape(networkClient.session?.name ?? "")}" /></label><div class="lobby-actions"><button id="create-room" type="button">ルームを作る</button><span>または</span><input id="room-code" maxlength="6" placeholder="合言葉" autocomplete="off" value="${this.escape(invitedRoom)}" /><button id="join-room" type="button">参加する</button></div><p id="connection-status" aria-live="polite">未接続</p><p id="lobby-error" role="alert"></p><section id="room-area" hidden><h2>合言葉 <strong id="current-room"></strong></h2><button id="copy-invite" type="button">招待リンクをコピー</button><ul id="player-list"></ul><div class="lobby-actions"><button id="ready-button" type="button">準備OK</button><button id="start-button" type="button">ゲーム開始</button></div></section>`;
    document.body.append(panel);
    this.panel = panel;
    panel.querySelector("#create-room")?.addEventListener("click", () => void this.createRoom());
    panel.querySelector("#join-room")?.addEventListener("click", () => void this.joinRoom());
    panel
      .querySelector("#ready-button")
      ?.addEventListener("click", () => networkClient.setReady(true));
    panel
      .querySelector("#start-button")
      ?.addEventListener("click", () => networkClient.startGame());
    panel.querySelector("#copy-invite")?.addEventListener("click", () => {
      void navigator.clipboard
        .writeText(location.href)
        .then(() => this.showError("招待リンクをコピーしました"));
    });
  }

  private async createRoom(): Promise<void> {
    const name = this.playerName();
    if (!name) {
      this.showError("表示名を入力してください");
      return;
    }
    this.showError("");
    try {
      await networkClient.createRoom(name);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "接続できません");
    }
  }

  private async joinRoom(): Promise<void> {
    const name = this.playerName();
    const code = (this.panel?.querySelector<HTMLInputElement>("#room-code")?.value ?? "")
      .trim()
      .toUpperCase();
    if (!name) {
      this.showError("表示名を入力してください");
      return;
    }
    if (!/^[A-Z0-9]{4,6}$/.test(code)) {
      this.showError("合言葉は4〜6文字の英数字です");
      return;
    }
    this.showError("");
    try {
      await networkClient.joinRoom(code, name);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "接続できません");
    }
  }

  private onMessage(message: ServerMessage): void {
    if (message.type === "session_established") {
      this.roomCode = message.roomCode;
      this.showRoom();
    } else if (message.type === "room_state") {
      this.roomCode = message.room.code;
      this.renderPlayers(message.room.players, message.room.hostPlayerId);
    } else if (message.type === "game_started") this.scene.start("game");
    else if (message.type === "error")
      this.showError(message.message ?? this.errorText(message.code));
  }

  private renderPlayers(players: PlayerSummary[], hostId: string): void {
    this.showRoom();
    const list = this.panel?.querySelector("#player-list");
    if (list)
      list.innerHTML = players
        .map(
          (player) =>
            `<li><span class="player-color" style="background:${player.color}"></span>${this.escape(player.name)}${player.id === hostId ? "（作成者）" : ""}<strong>${player.connected ? (player.ready ? "準備OK" : "待機中") : "再接続待ち"}</strong></li>`,
        )
        .join("");
    const start = this.panel?.querySelector<HTMLButtonElement>("#start-button");
    if (start) start.hidden = networkClient.session?.playerId !== hostId;
  }

  private showRoom(): void {
    const area = this.panel?.querySelector<HTMLElement>("#room-area");
    if (area) area.hidden = false;
    const code = this.panel?.querySelector("#current-room");
    if (code) code.textContent = this.roomCode;
    if (this.roomCode) {
      const url = new URL(location.href);
      url.searchParams.set("room", this.roomCode);
      history.replaceState(null, "", url);
    }
  }
  private showConnection(state: ConnectionState): void {
    const element = this.panel?.querySelector("#connection-status");
    if (element)
      element.textContent = {
        disconnected: "未接続",
        connecting: "接続中…",
        connected: "接続済み",
        reconnecting: "再接続中…",
      }[state];
  }
  private showError(message: string): void {
    const element = this.panel?.querySelector("#lobby-error");
    if (element) element.textContent = message;
  }
  private playerName(): string {
    return (this.panel?.querySelector<HTMLInputElement>("#player-name")?.value ?? "").trim();
  }
  private errorText(code: string): string {
    return (
      (
        {
          ROOM_NOT_FOUND: "ルームが見つかりません",
          ROOM_FULL: "ルームは満員です",
          ROOM_ALREADY_STARTED: "ゲームは既に始まっています",
          NOT_READY: "全員が準備OKになるまで待ってください",
          NOT_HOST: "作成者だけが開始できます",
          RECONNECT_TOKEN_INVALID: "再接続の有効時間が切れました",
        } as Record<string, string>
      )[code] ?? "通信エラーが発生しました"
    );
  }
  private escape(value: string): string {
    const span = document.createElement("span");
    span.textContent = value;
    return span.innerHTML;
  }
  private destroyPanel(): void {
    for (const dispose of this.cleanup) dispose();
    this.cleanup = [];
    this.panel?.remove();
    this.panel = undefined;
  }
}
