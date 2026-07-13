# 無料で公開する手順

友人6人で遊ぶ用途では、次の組み合わせを使用します。

- ゲーム画面: Cloudflare Pages（無料）
- ゲームサーバー: Render Free Web Service（無料）
- 接続制限: 6人だけが知る友人用キー

Renderの無料サーバーは、毎月750時間まで利用できます。15分ほど通信がないと休止し、次の接続時に自動で起動します。起動に最大1分ほどかかる場合がありますが、ゲーム画面側が自動的に接続を繰り返します。

## 1. Renderへゲームサーバーを作る

1. [Render用の作成画面](https://render.com/deploy?repo=https://github.com/simosimo1333-png/games-5p-gpt)を開く。
2. GitHubアカウントでRenderへログインする。
3. リポジトリへのアクセスを求められたら、`games-5p-gpt` を許可する。
4. `ALLOWED_ORIGINS` に `https://games-5p-gpt.pages.dev` を入力する。
5. `FRIEND_ACCESS_KEY` に、12文字以上を目安に自分で決めた友人用キーを入力する。
6. 作成ボタンを押し、状態が `Live` になるまで待つ。

友人用キーには、名前や誕生日など推測されやすいものを使わないでください。この値はGitHubのファイルや公開Issueへ書かず、Renderの設定画面だけに保存します。

作成後のサーバーURLは、通常は次の形です。

```text
https://games-5p-gpt-server.onrender.com
```

ブラウザーで末尾に `/health` を付けて開き、`"ok":true` が表示されればサーバーは動いています。

```text
https://games-5p-gpt-server.onrender.com/health
```

## 2. ゲーム画面をサーバーへつなぐ

Cloudflare Pagesの `games-5p-gpt` プロジェクトを開き、ビルド時の変数を1つ設定します。

| 名前 | 入力する値 |
| --- | --- |
| `VITE_GAME_SERVER_URL` | `wss://games-5p-gpt-server.onrender.com` |

保存後、最新のコミットをもう一度公開します。公開が終わったら、次を開きます。

```text
https://games-5p-gpt.pages.dev
```

表示名と友人用キーを入力し、「ルームを作る」を押せれば接続成功です。

## 3. GitHubの自動確認を有効にする

GitHubのリポジトリで `Settings`、`Secrets and variables`、`Actions`、`Variables` の順に開き、次の3つを登録します。

| 名前 | 入力する値 |
| --- | --- |
| `PRODUCTION_CLIENT_URL` | `https://games-5p-gpt.pages.dev` |
| `PRODUCTION_SERVER_URL` | `https://games-5p-gpt-server.onrender.com` |
| `PRODUCTION_WEBSOCKET_URL` | `wss://games-5p-gpt-server.onrender.com` |

これにより、GitHubが公開サーバーの状態を定期的に確認します。友人用キーはGitHubへ登録しません。

## 4. 6人を招待する

主催者がルームを作ると、ルーム番号と友人用キーを含む招待リンクが表示されます。そのリンクを、遊ぶ5人へ個別のメッセージで送ります。

招待リンクをSNSや公開掲示板へ載せないでください。詳しい当日の流れは [6人で遊ぶ手順](friends-play-guide.md) を参照してください。

## 無料利用の注意

- 15分ほど使わないと休止するため、主催者は遊ぶ5分前にルームを作るとスムーズです。
- Renderの無料枠は趣味・テスト向けです。毎日24時間動かし続ける用途には向きません。
- 支払い方法を登録していない状態で無料枠の上限へ達した場合、追加請求ではなくサービスが停止します。
- サーバーを再起動すると、進行中のルームは終了します。もう一度ルームを作ってください。

## 友人用キーを変更する

招待リンクが外部へ漏れた場合は、Renderのサービス画面で `Environment` を開き、`FRIEND_ACCESS_KEY` を新しい値へ変更します。保存後にサーバーが再起動するため、新しいキーでルームと招待リンクを作り直します。

## 問題が起きたとき

1. Renderの状態が `Live` か確認する。
2. `/health` を開き、`"ok":true` が表示されるか確認する。
3. Cloudflare Pagesの `VITE_GAME_SERVER_URL` が `wss://` から始まっているか確認する。
4. ゲーム画面の友人用キーと、Renderの `FRIEND_ACCESS_KEY` が同じか確認する。
5. 修正後、ルームを作り直す。

公開前後の動作確認には [リリース確認表](release-checklist.md) を使用します。運用中の確認方法は [運用・障害対応](operations.md) にまとめています。

## 直前の版へ戻す場合

GitHubの `Actions` から、直前に正常だったリリースを選んで再公開します。Renderでは `Events` から正常だった公開履歴を選び、再配置できます。戻した後は `/health`、6人参加、ゲーム開始をもう一度確認します。
