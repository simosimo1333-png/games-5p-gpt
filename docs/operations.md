# 運用・障害対応

## 本番の必須設定

- `PORT`: 公開サービスから割り当てられた待受ポート
- `ALLOWED_ORIGINS`: 接続を許可するクライアントURLをカンマ区切りで指定する（例: `https://games-5p-gpt.pages.dev`）

本番では `ALLOWED_ORIGINS` を空にしないでください。許可リスト外のWebサイトからのWebSocket接続は拒否します。

## ヘルスチェック

サーバーの `/health` は次を返します。

```json
{ "ok": true, "rooms": 0 }
```

公開サービス側の監視では1分ごとに確認し、3回連続で失敗した場合に通知します。

GitHub Actionsの `Production monitor` は補助監視です。Repository Variableの `PRODUCTION_SERVER_URL` が設定されると30分ごとに自動確認します。手動確認は `PRODUCTION_SERVER_URL=https://... npm run check:production` で実行できます。

## 主要指標

`/metrics` では、進行中ルーム・接続数に加えて、開始回数、完走回数、受信メッセージ数、エラー数、切断数、再接続数、最大処理遅延を確認できます。表示名や再接続用コードは含みません。

## 構造化ログ

ログは1行1JSONで、時刻、重要度、イベント、相関ID、ルームコード、プレイヤーID、人数を記録します。表示名、再接続トークンなどの秘密情報は出力しません。

主なイベント:

- `server.started`
- `connection.opened`
- `room.joined`
- `connection.lost`
- `message.failed`

相関IDを検索すると、1接続の開始から切断までを追跡できます。ルームコードを検索すると、同じゲームの参加者をまとめて確認できます。

## 推奨アラート

- `/health` が3分間失敗
- `message.failed` が5分間で全メッセージの5%を超える
- 再接続失敗率が10%を超える
- tick処理が25ミリ秒を超える状態が1分継続

## 障害時の手順

1. ヘルスチェックと直近のデプロイを確認する。
2. `message.failed` と `connection.lost` を相関ID・ルームコードで確認する。
3. 新しい版が原因なら直前の正常版へ戻す。
4. 復旧後、影響時間、対象ルーム数、原因、再発防止をIssueへ記録する。

サーバーを直前版へ戻す具体的な操作は [公開手順](deployment.md)、公開前後の確認は [リリース確認表](release-checklist.md) を使用します。

サーバーは状態をメモリに保持するため、再起動すると進行中ルームは終了します。再起動は利用の少ない時間に行い、クライアントには再参加を案内します。
