# `@houkago/protocol`

「放課後ダッシュ！」のクライアントとサーバーが共有する通信ルールです。

## 役割

- クライアントから送るメッセージの形式を定義する
- サーバーから返すメッセージの形式を定義する
- 受信したデータが正しいか実行時に検査する
- 通信ルールのバージョン違いを専用エラーとして通知する

クライアントとサーバーは独自の通信型を作らず、必ずこのパッケージから型と検査関数を読み込みます。

## 主な公開要素

- `PROTOCOL_VERSION`: 現在の通信ルールのバージョン
- `ClientMessageSchema` / `ServerMessageSchema`: 受信データの検査ルール
- `parseClientMessage` / `parseServerMessage`: 検査済みメッセージを返す関数
- `ProtocolValidationError`: 不正データやバージョン違いを表すエラー

通信形式を変更するときは、既存アプリとの互換性を確認し、互換性がない変更では `PROTOCOL_VERSION` を増やします。
