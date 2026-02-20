---
paths: [my-app/app/api/discord/**/*.ts]
---

# Discord API 開発ルール

## Discord Interactionの処理フロー

1. **Discordからのリクエスト受信** (`app/api/discord/route.ts`)
   - 署名検証 (Ed25519)
   - インタラクションタイプに応じて処理を分岐
     - `PING`: Pong応答
     - `APPLICATION_COMMAND`: スラッシュコマンド実行
     - `MESSAGE_COMPONENT`: ボタンクリックやセレクトメニュー操作
     - `MODAL_SUBMIT`: モーダル送信

2. **コマンド実行**
   - `/lol-new-protect`: 試合IDを生成し、ブルーサイド・レッドサイドにプロテクトやロールを入力、同時公表できるボタンを表示
   - `/lol-feedback`: フィードバック種類選択メニューを表示
   - `/lol-echo`: 入力をそのまま返す
   - `/dev-test`: 開発者用の動作確認コマンド

## Discord API 仕様

公式ドキュメントが正ではあるが、あまりにAIが古い情報等に惑わされてミスするので、一部をここに記載する。

### インタラクションタイプ

`DISCORD_INTERACTION_TYPE` で定義。[公式ドキュメント](https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-type)

### レスポンスタイプ

- `type: 1` → Pong
- `type: 4` → メッセージ返信
- `type: 9` → モーダル表示

### コンポーネント

[公式ドキュメント](https://discord.com/developers/docs/interactions/message-components)

- `type: 1` → Action Row (コンテナ)
- `type: 2` → Button
- `type: 3` → String Select Menu
- `type: 4` → Text Input (モーダル内)

### その他の仕様

- **Ephemeralメッセージ**: `flags: 64` で送信者のみに表示
- **custom_id の長さ制限**: Discord の custom_id は100文字まで。クエリパラメータを含める場合は注意
- **モーダルの制限**:
  - モーダルは最大5つのAction Rowまで
  - Action Row と Label でモーダルに載せられるコンポーネントが違う。String SelectはLabelでラップする必要がある。
- **非同期処理**: Discord Interactionは3秒以内に応答する必要がある。重い処理は後続処理で対応

## データ保存設計

Redis のキー体系・データ型はコードを確認する。

| 用途                 | 参照先ファイル                   |
| -------------------- | -------------------------------- |
| Redisキー定義        | `my-app/app/util/redisKeys.ts`   |
| 試合・チームデータ型 | `my-app/app/types/match.ts`      |
| Redis操作ラッパー    | `my-app/app/libs/redis/redis.ts` |
| セッション管理       | `my-app/app/libs/session.ts`     |
