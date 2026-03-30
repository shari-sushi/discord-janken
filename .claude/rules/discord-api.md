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
   - `/lol-new-match`: 試合IDを生成し、ブルーサイド・レッドサイドにプロテクトやロールを入力、同時公表できるボタンを表示
   - `/fighting-team-order`: 格ゲーチーム戦の出場順を両チーム同時に発表
   - `/user-feedback`: フィードバック種類選択メニューを表示
   - `/user-timer`: 指定時刻にメッセージを送信するタイマーを設定
   - `/user-common-message`: 複数人で編集できる共有メッセージを投稿
   - `/dev-echo`: 入力をそのまま返す
   - `/dev-test`: 開発者用の動作確認コマンド

## Discord API 仕様

公式ドキュメントが正ではあるが、AIが古い情報等に惑わされてミスすることが多いものを記載した。

### インタラクションタイプ

`DISCORD_INTERACTION_TYPE` で定義。
[公式ドキュメント](https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-type)

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

## Bot 権限の管理

コマンドの機能を追加・変更した場合、使用する Discord API エンドポイントが変わることがある。
その際は `README.md` の「Bot 必要権限」セクションのパーミッション一覧を必ず更新すること。


## データ保存設計

Redis のキー体系・データ型はコードを確認する。

| 用途                 | 参照先ファイル                          |
| -------------------- | --------------------------------------- |
| Redisキー定義        | `my-app/app/_server/util/redisKeys.ts`  |
| 試合・チームデータ型 | `my-app/app/types/match.ts`             |
| Redis操作ラッパー    | `my-app/app/_server/lib/redis/redis.ts` |
| セッション管理       | `my-app/app/_server/lib/session.ts`     |
