# 公開手順

## 公開物

- クライアント: Cloudflare Pagesが `apps/client/dist` を配信する
- ゲームサーバー: GitHub Container Registryの `games-5p-gpt-server` イメージを、常時WebSocket接続できるサービスで動かす
- 通信: 公開環境では必ずHTTPS/WSSを使う

## GitHubに登録する値

Repository settings の Variables に次を登録する。

| 名前 | 例 | 用途 |
| --- | --- | --- |
| `PRODUCTION_CLIENT_URL` | `https://games-5p-gpt.pages.dev` | サーバーが許可する画面URL |
| `PRODUCTION_SERVER_URL` | `https://game.example.com` | 監視とクライアントビルドに使うサーバーURL |
| `PRODUCTION_WEBSOCKET_URL` | `wss://game.example.com` | クライアントが接続するWebSocket URL |

Cloudflare Pagesのビルド変数 `VITE_GAME_SERVER_URL` には、`PRODUCTION_WEBSOCKET_URL` と同じ値を登録する。

## サーバーの起動

1. `.env.example` を参考に、公開先の秘密設定へ `ALLOWED_ORIGINS` を登録する。
2. リリースで作られた `ghcr.io/simosimo1333-png/games-5p-gpt-server:<version>` を指定する。
3. 公開先のヘルスチェックを `/health`、ポートを `8787` にする。
4. TLSを有効にし、外部からは `wss://` と `https://` だけを許可する。
5. `/health` と `/metrics` を確認してからクライアントの接続先を切り替える。

Docker Composeを使える公開先では、次の形で起動できる。

```bash
docker compose --env-file .env -f compose.production.yml up -d --no-build
```

サーバーは進行中の部屋をメモリに保存する。版の切り替え時は進行中の部屋が0であることを `/metrics` で確認する。

## ステージング

本番と別のサーバーURLとCloudflare PagesのプレビューURLを使う。`ALLOWED_ORIGINS` にはプレビューURLだけを登録し、2台協力テストに合格してから本番へ進める。

## 戻す手順

直前に正常だったタグを指定して、まず内容を確認する。

```bash
npm run rollback:server -- --tag v0.2.0
```

表示されたイメージが正しいことを確認し、公開サーバー上で実行する。

```bash
npm run rollback:server -- --tag v0.2.0 --execute
```

復旧後に `/health`、2台参加、ゲーム開始を確認する。Cloudflare Pagesは管理画面の Deployments から直前の正常版を選び、Rollbackを実行する。
