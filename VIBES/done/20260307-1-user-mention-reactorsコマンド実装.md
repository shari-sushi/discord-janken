# `/user-mention-reactors` コマンド実装

## 目的

リアクションをつけた全ユーザーにメンションを送る機能を実装する。

## 背景

### issue #56の要約

Discord上で特定のメッセージにリアクションした全員にメンションを送りたい場合がある。

**要件:**
1. コマンド実行：required optionでメッセージのリンクを受け取る
2. リアクション取得：選択されたメッセージについているリアクションを取得
3. メッセージ投稿：embedでそのリアクションについていた人全員にメンション、メッセージ内容、created by コマンド実行者を表示

## 実装計画

### 1. Discord API拡張

**ファイル:** `my-app/app/_server/lib/discord/api.ts`

新しいAPI関数を追加：
- `getDiscordMessage(channelId, messageId)`: メッセージ情報を取得
- `getMessageReactions(channelId, messageId, emoji)`: 特定の絵文字のリアクションユーザーを取得

### 2. ドメイン型定義

**ファイル:** `my-app/app/domains/user/mentionByReaction/types.ts`

```typescript
export interface MessageLinkParsed {
  guildId: string
  channelId: string
  messageId: string
}

export interface ReactionUser {
  id: string
  username: string
}
```

### 3. コマンド定義の追加

**ファイル:** `my-app/app/_server/util/commands.ts`

```typescript
USER: {
  // 既存...
  MENTION_BY_REACTION: USER_PREF + "mention-by-reaction",
}
```

### 4. コマンド登録

**ファイル:** `my-app/app/api/discord/command/register.ts`

```typescript
const mentionByReaction: DiscordBotCommand = {
  name: COMMANDS.USER.MENTION_BY_REACTION,
  description: "特定のメッセージに指定のリアクションをつけた人にメンションでメッセージを送れます",
  options: [
    {
      name: "message_link",
      description: "メッセージのリンク（右クリック→メッセージのリンクをコピー）",
      type: ApplicationCommandOptionType.STRING,
      required: true,
    },
  ],
}
```

### 5. コマンド実装

**ファイル:** `my-app/app/api/discord/command/user/mentionReactors.ts`

#### 処理フロー

1. **メッセージリンクのパース**
   - Discord メッセージリンクの形式: `https://discord.com/channels/{guild_id}/{channel_id}/{message_id}`
   - パース失敗時はエラーメッセージを返す

2. **メッセージ情報の取得**
   - Discord APIでメッセージ情報を取得
   - メッセージが存在しない場合はエラー

3. **リアクション情報の取得**
   - メッセージについている全リアクションを取得
   - 各リアクションについてユーザーリストを取得

4. **Embedメッセージの作成**
   - タイトル: "リアクションメンバー"
   - フィールド:
     - リアクション絵文字ごとにユーザーメンションリスト
     - 元メッセージの内容
   - フッター: "Created by {コマンド実行者名}"

5. **メッセージ投稿**
   - コマンドを実行したチャンネルにembedを投稿

### 6. ルーティング設定

**ファイル:** `my-app/app/api/discord/route.ts`

```typescript
case COMMANDS.USER.MENTION_REACTORS:
  return mentionReactorsCommand(options || [])
```

### 7. テスト方針

- メッセージリンクのパース機能
- リアクション取得機能
- Embed生成機能
- エラーハンドリング（存在しないメッセージ、不正なリンク等）

## 技術選定

### Discord API エンドポイント

- **メッセージ取得:** `GET /channels/{channel_id}/messages/{message_id}`
  - レスポンス: メッセージオブジェクト（content, reactions含む）

- **リアクションユーザー取得:** `GET /channels/{channel_id}/messages/{message_id}/reactions/{emoji}`
  - レスポンス: ユーザーオブジェクト配列
  - 注意: 絵文字のエンコーディング（カスタム絵文字は `name:id` 形式）

### メッセージリンクのパース

正規表現またはURL解析を使用：

通常のurlの他に、`ptb.discord.com``canary.discord.com`といったサブドメインがあることに注意。
※canary discordでメッセージリンクをコピーすると`canary.discord`になる

```typescript
const messageLinkRegex = /(?:https?:\/\/)?(?:\w+\.)?discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/
```

### Embedフォーマット

Discord Embed形式を使用：

- `embeds` 配列にembedオブジェクトを含める
- `fields` でリアクションごとのユーザーリストを表示
- `footer` でコマンド実行者を表示

## 参考資料

- [Discord API - Get Channel Message](https://discord.com/developers/docs/resources/channel#get-channel-message)
- [Discord API - Get Reactions](https://discord.com/developers/docs/resources/channel#get-reactions)
- [Discord API - Embed Object](https://discord.com/developers/docs/resources/channel#embed-object)
- [Message Formatting - Discord Developer Portal](https://discord.com/developers/docs/reference#message-formatting)

## 注意事項

1. **権限チェック**: Bot がメッセージを取得できるチャンネルかどうか
2. **レート制限**: Discord API のレート制限に注意
3. **大量のリアクション**: リアクションユーザーが多い場合の対応（100件以上の場合はページネーション）
4. **カスタム絵文字**: カスタム絵文字のエンコーディング処理
5. **メッセージの長さ制限**: Embedのフィールド値は1024文字まで
