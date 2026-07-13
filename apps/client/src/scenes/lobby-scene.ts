import Phaser from "phaser";

import { networkClient, type ConnectionState } from "../network/network-client";
import { soundManager } from "../audio/sound-manager";
import { GAME_WIDTH } from "../config/game";
import { loadPreferences, savePreferences, type Preferences } from "../ui/preferences";
import type {
  Difficulty,
  PlayerRole,
  PlayerSummary,
  ServerMessage,
  StageId,
} from "../../../../packages/protocol/src";

export class LobbyScene extends Phaser.Scene {
  private cleanup: Array<() => void> = [];
  private panel: HTMLDivElement | undefined;
  private roomCode = "";
  private selectedRole: PlayerRole = "runner";
  private awaitingFreshSession = false;
  private preferences: Preferences = loadPreferences();

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
    panel.innerHTML = `<details class="how-to-play" open><summary>遊び方</summary><ol><li>名前を入れ、ルームを作るか合言葉で参加</li><li>役割を選び、全員が「準備OK」</li><li>左右移動とジャンプで進み、2つの床スイッチを仲間と同時に押す</li><li>落ちた仲間の近くで「助ける」を押し、全員でゴールへ到着</li></ol></details><label>表示名<input id="player-name" maxlength="24" autocomplete="nickname" value="${this.escape(networkClient.session?.name ?? "")}" /></label><label>友人用キー<small>招待した6人だけで共有します</small><input id="friend-key" type="password" maxlength="128" autocomplete="off" value="${this.escape(networkClient.friendAccessKey)}" /></label><div class="lobby-actions"><button id="create-room" type="button">ルームを作る</button><span>または</span><input id="room-code" maxlength="6" placeholder="合言葉" autocomplete="off" value="${this.escape(invitedRoom)}" /><button id="join-room" type="button">参加する</button></div><fieldset id="preferences"><legend>遊びやすさ設定</legend><label><input id="sound-setting" type="checkbox" ${this.checked(this.preferences.sound)} />効果音</label><label><input id="motion-setting" type="checkbox" ${this.checked(this.preferences.reducedMotion)} />動きを減らす</label><label><input id="contrast-setting" type="checkbox" ${this.checked(this.preferences.highContrast)} />高コントラスト</label><label><input id="text-setting" type="checkbox" ${this.checked(this.preferences.largeText)} />文字を大きく</label></fieldset><p id="connection-status" aria-live="polite">未接続</p><p id="lobby-error" role="alert"></p><section id="room-area" hidden><h2>合言葉 <strong id="current-room"></strong></h2><button id="copy-invite" type="button">招待リンクをコピー</button><fieldset id="game-options"><legend>ステージと難易度（作成者が選択）</legend><label>ステージ<select id="stage-select"><option value="school-gate">校門まで走れ！</option><option value="rooftop-relay">屋上リレー！</option><option value="gym-escape">体育館脱出！</option></select></label><label>難易度<select id="difficulty-select"><option value="casual">やさしい（240秒・復帰が早い）</option><option value="standard" selected>標準（180秒）</option><option value="challenge">挑戦（150秒・復帰が遅い）</option></select></label></fieldset><fieldset id="role-select"><legend>役割を選ぶ</legend><label><input type="radio" name="player-role" value="runner" checked />ランナー<small>速く走れる</small></label><label><input type="radio" name="player-role" value="jumper" />ジャンパー<small>高く跳べる</small></label><label><input type="radio" name="player-role" value="supporter" />サポーター<small>遠くから助けられる</small></label></fieldset><ul id="player-list"></ul><div class="lobby-actions"><button id="ready-button" type="button">準備OK</button><button id="start-button" type="button">ゲーム開始</button></div></section><footer class="legal-links"><a href="https://github.com/simosimo1333-png/games-5p-gpt/blob/main/docs/privacy-policy.md" target="_blank" rel="noreferrer">プライバシー</a><a href="https://github.com/simosimo1333-png/games-5p-gpt/blob/main/docs/terms-of-use.md" target="_blank" rel="noreferrer">利用規約</a></footer>`;
    document.body.append(panel);
    this.panel = panel;
    panel.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("button")) soundManager.play("click");
    });
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
    panel.querySelector("#role-select")?.addEventListener("change", (event) => {
      const role = (event.target as HTMLInputElement).value as PlayerRole;
      if (!["runner", "jumper", "supporter"].includes(role)) return;
      this.selectedRole = role;
      networkClient.setRole(role);
      this.showError("役割を変更したため、もう一度『準備OK』を押してください");
    });
    panel.querySelector("#game-options")?.addEventListener("change", () => {
      const stageId = panel.querySelector<HTMLSelectElement>("#stage-select")?.value as StageId;
      const difficulty = panel.querySelector<HTMLSelectElement>("#difficulty-select")
        ?.value as Difficulty;
      networkClient.setGameOptions(stageId, difficulty);
      this.showError("ステージを変更したため、全員がもう一度『準備OK』を押してください");
    });
    panel.querySelector("#preferences")?.addEventListener("change", () => {
      this.preferences = {
        sound: panel.querySelector<HTMLInputElement>("#sound-setting")?.checked ?? true,
        reducedMotion: panel.querySelector<HTMLInputElement>("#motion-setting")?.checked ?? false,
        highContrast: panel.querySelector<HTMLInputElement>("#contrast-setting")?.checked ?? false,
        largeText: panel.querySelector<HTMLInputElement>("#text-setting")?.checked ?? false,
      };
      savePreferences(this.preferences);
      soundManager.setPreferences(this.preferences);
    });
  }

  private async createRoom(): Promise<void> {
    const name = this.playerName();
    if (!name) {
      this.showError("表示名を入力してください");
      return;
    }
    this.saveFriendKey();
    this.showError("");
    try {
      this.awaitingFreshSession = true;
      await networkClient.createRoom(name);
    } catch (error) {
      this.awaitingFreshSession = false;
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
    this.saveFriendKey();
    this.showError("");
    try {
      this.awaitingFreshSession = true;
      await networkClient.joinRoom(code, name);
    } catch (error) {
      this.awaitingFreshSession = false;
      this.showError(error instanceof Error ? error.message : "接続できません");
    }
  }

  private onMessage(message: ServerMessage): void {
    if (message.type === "session_established") {
      this.roomCode = message.roomCode;
      this.showRoom();
      if (this.awaitingFreshSession) {
        networkClient.setRole(this.selectedRole);
        this.awaitingFreshSession = false;
      }
    } else if (message.type === "room_state") {
      this.roomCode = message.room.code;
      this.renderPlayers(
        message.room.players,
        message.room.hostPlayerId,
        message.room.stageId,
        message.room.difficulty,
      );
      if (message.room.phase === "playing")
        this.scene.start("game", { stageId: message.room.stageId });
    } else if (message.type === "game_started")
      this.scene.start("game", { stageId: message.stageId });
    else if (message.type === "error")
      this.showError(message.message ?? this.errorText(message.code));
  }

  private renderPlayers(
    players: PlayerSummary[],
    hostId: string,
    stageId: StageId,
    difficulty: Difficulty,
  ): void {
    this.showRoom();
    const list = this.panel?.querySelector("#player-list");
    if (list)
      list.innerHTML = players
        .map(
          (player) =>
            `<li><span class="player-color" style="background:${player.color}"></span><span>${this.escape(player.name)}${player.id === hostId ? "（作成者）" : ""}<small>${this.roleText(player.role)}</small></span><strong>${player.connected ? (player.ready ? "準備OK" : "待機中") : "再接続待ち"}</strong></li>`,
        )
        .join("");
    const start = this.panel?.querySelector<HTMLButtonElement>("#start-button");
    if (start) start.hidden = networkClient.session?.playerId !== hostId;
    const options = this.panel?.querySelector<HTMLFieldSetElement>("#game-options");
    if (options) options.disabled = networkClient.session?.playerId !== hostId;
    const stage = this.panel?.querySelector<HTMLSelectElement>("#stage-select");
    const level = this.panel?.querySelector<HTMLSelectElement>("#difficulty-select");
    if (stage) stage.value = stageId;
    if (level) level.value = difficulty;
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
  private saveFriendKey(): void {
    const key = this.panel?.querySelector<HTMLInputElement>("#friend-key")?.value ?? "";
    networkClient.setFriendAccessKey(key);
    const url = new URL(location.href);
    if (key.trim()) url.searchParams.set("friend", key.trim());
    else url.searchParams.delete("friend");
    history.replaceState(null, "", url);
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
  private roleText(role: PlayerRole): string {
    return { runner: "ランナー", jumper: "ジャンパー", supporter: "サポーター" }[role];
  }
  private checked(value: boolean): string {
    return value ? "checked" : "";
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
