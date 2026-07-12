# ディレクトリ構成

## 現在

```text
games-5p-gpt/
├─ README.md
├─ index.html
└─ houkago-dash-starter.zip
```

`index.html` に表示、入力、物理、UI、ステージ定義が集中している。ZIPは生成元と更新手順が不明なため、現時点では削除せず、別Issueで扱いを決める。

## 移行後の目標

```text
games-5p-gpt/
├─ apps/
│  ├─ client/
│  │  ├─ public/
│  │  ├─ src/
│  │  │  ├─ config/
│  │  │  ├─ entities/
│  │  │  ├─ input/
│  │  │  ├─ network/
│  │  │  ├─ scenes/
│  │  │  ├─ stages/
│  │  │  ├─ state/
│  │  │  ├─ ui/
│  │  │  └─ main.ts
│  │  └─ tests/
│  └─ server/
│     ├─ src/
│     │  ├─ config/
│     │  ├─ rooms/
│     │  ├─ simulation/
│     │  ├─ transport/
│     │  └─ main.ts
│     └─ tests/
├─ packages/
│  ├─ protocol/
│  ├─ game-core/
│  └─ test-utils/
├─ docs/
│  ├─ current-state-analysis.md
│  ├─ game-design.md
│  ├─ technical-design.md
│  ├─ roadmap.md
│  └─ directory-structure.md
├─ e2e/
├─ tools/
├─ .github/
│  ├─ ISSUE_TEMPLATE/
│  ├─ workflows/
│  └─ pull_request_template.md
├─ package.json
├─ tsconfig.base.json
└─ README.md
```

## 各領域の責務

### `apps/client`

ブラウザへ配布するPhaserクライアント。入力を意図へ変換し、描画とUXを担当する。オンライン時のゲーム状態を最終決定しない。

- `config`: 解像度、物理、環境別設定
- `entities`: プレイヤー、足場、ギミックの表示とクライアント側振る舞い
- `input`: キーボード・タッチから共通入力への変換
- `network`: WebSocket、再接続、メッセージ変換
- `scenes`: Boot、Lobby、Game、Resultなど画面単位のオーケストレーション
- `stages`: ステージデータの読込と表示
- `state`: サーバー状態、補間、ローカルUI状態
- `ui`: HUD、ダイアログ、接続表示

### `apps/server`

ルームとゲーム状態の正本。クライアント入力を検証し、固定tickのシミュレーション結果を配信する。

- `rooms`: 作成、参加、準備、開始、終了、退出、再接続
- `simulation`: 移動、衝突、能力、ゴールなど決定的なゲーム規則
- `transport`: 接続、認証、メッセージ送受信、レート制限

### `packages/protocol`

クライアントとサーバーが共有するメッセージ型、スキーマ、エラーコード、プロトコルバージョン。Phaserやサーバーフレームワークへ依存させない。

### `packages/game-core`

純粋関数として共有できるルール、定数、ステージ型。描画やネットワークに依存させず、単体テストを高速にする。

### `packages/test-utils`

複数クライアント、疑似時刻、ネットワーク障害、ステージfixtureなど、テスト専用の共通部品。

### `e2e`

実ブラウザと起動済みサーバーを使うシナリオ。ルーム作成、複数参加、プレイ、切断復帰、結果、再挑戦を対象とする。

### `tools`

ステージ検証、アセット処理、ローカル開発支援など。生成物をコミットする場合は、生成元と再生成コマンドを明記する。

## 依存方向

```text
apps/client ─┬─> packages/protocol
             └─> packages/game-core

apps/server ─┬─> packages/protocol
             └─> packages/game-core

e2e ───────────> apps/client + apps/server
```

`packages` から `apps` への逆依存は禁止する。`game-core` は `protocol` に依存せず、ゲーム規則と通信表現を分離する。

## 段階的な移行

1. ルートにワークスペース設定を追加する。
2. `apps/client` を作成し、既存ゲームを小さな単位で移す。
3. 新旧クライアントの機能同等性を確認する。
4. `packages/protocol` と `apps/server` を追加する。
5. 新構成を既定化後、旧 `index.html` とZIPの扱いを決定する。

一括移動は避け、各段階で起動可能な状態を維持する。
