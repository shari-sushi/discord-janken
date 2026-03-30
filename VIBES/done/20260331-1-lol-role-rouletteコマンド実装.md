# `/lol-role-roulette` コマンド実装

## 目的

LoLカスタムゲームのロール抽選をDiscord上で行えるようにする。
参加者がリアクションで希望ロールを表明し、Bot が公平なランダム抽選を行う。

## 実装計画

### 1. Discord API 追加

**ファイル:** `my-app/app/_server/lib/discord/api.ts`

追加する関数：

- `addReaction(channelId, messageId, emoji)`: リアクションを追加する
  - `PUT /channels/{channelId}/messages/{messageId}/reactions/{emoji}/@me`
- `deleteAllReactions(channelId, messageId)`: 全リアクションを削除する
  - `DELETE /channels/{channelId}/messages/{messageId}/reactions`
- `getReactionUsers(channelId, messageId, emoji)`: 特定絵文字のリアクションユーザーを取得する（既存の `getMessageReactions` を export に変更、または新関数として追加）

### 2. コマンド定数追加

**ファイル:** `my-app/app/_server/util/commands.ts`

```typescript
COMMANDS.LOL.ROLE_ROULETTE = LOL_PREF + "role-roulette"

CLIENT_ACTIONS.LOL.ROLE_ROULETTE_START = "lol-role-roulette-start"
CLIENT_ACTIONS.LOL.ROLE_ROULETTE_RESET = "lol-role-roulette-reset"
```

### 3. コマンド登録

**ファイル:** `my-app/app/api/discord/command/register.ts`

```typescript
const roleRoulette: RESTPostAPIApplicationCommandsJSONBody = {
  name: COMMANDS.LOL.ROLE_ROULETTE,
  description: "LoLのロール抽選を行います",
  options: [],
}
```

### 4. ロール抽選アルゴリズム

**ファイル:** `my-app/app/domains/lol/_server/roleRouletteRoulette.ts`

#### 定数

```typescript
export const ROLE_EMOJIS = {
  TOP:  "1️⃣",  // :one:
  JG:   "2️⃣",  // :two:
  MID:  "3️⃣",  // :three:
  ADC:  "4️⃣",  // :four:
  SUP:  "5️⃣",  // :five:
  FILL: "*️⃣",  // :asterisk:
} as const

export const ROLE_LABELS: Record<Exclude<keyof typeof ROLE_EMOJIS, "FILL">, string> = {
  TOP: "TOP",
  JG:  "JG",
  MID: "MID",
  ADC: "ADC",
  SUP: "SUP",
}
```

#### 型定義

```typescript
export type RoleKey = keyof typeof ROLE_LABELS
export type RoleAssignment = Record<RoleKey, string>  // roleKey -> userId

export type RouletteResult =
  | { ok: true; assignment: RoleAssignment; rest: string[] }
  | { ok: false; error: string }
```

#### 抽選関数

```typescript
export function runRoleRoulette(
  reactorsByRole: Record<RoleKey | "FILL", string[]>,  // userId[]（Botを除外済み）
  botId: string,
): RouletteResult
```

処理フロー:

1. **Bot除外**：各ロールのリアクションユーザーから Bot ID を除外
2. **ユニーク参加者集計**：全ロール+FILLにリアクションしたユニークユーザーIDセット
3. **バリデーション①**：ユニーク参加者が4人以下 → `"参加希望者は5人必要です"` でエラー返却
4. **バリデーション②**：各ロール（TOP〜SUP）について、`reactorsByRole[role] + reactorsByRole["FILL"]` が空 → `"○○ができる人がいません"` で即時エラー返却
5. **適格性マップ構築**：各ロールに担当できるユーザー一覧 = そのロールにリアクション済み OR FILL にリアクション済み
6. **休憩者を先に決定する（fill偏り防止）**：
   - 全参加者をシャッフル
   - 先頭5人を `candidates`（参加）、残りを `rest`（休憩）として仮定する
   - fill参加者がどのロールでも埋められるため、バックトラッキングで割り当てを先に行うと fill 参加者が休憩に入りにくくなる問題を防ぐための設計
7. **ロール割り当て（バックトラッキング）**：
   - ロール順（TOP〜SUP）をシャッフルする
   - シャッフル済みのロール順に、candidates から適格者を1人選びながら再帰的に割り当てを試みる
   - 割り当てに失敗した場合は別のシャッフルで再試行（MAX_ATTEMPTS 回）
   - 全試行失敗 → `"有効な割り当てが見つかりませんでした。役職希望の偏りを見直してください。"` でエラー返却
8. **休憩リスト**：手順6で決定した `rest` をそのまま返す

### 5. コマンド実装

**ファイル:** `my-app/app/api/discord/command/lol/roleRoulette.ts`

#### `roleRouletteCommand`（スラッシュコマンド受信時）

処理フロー:

1. `InteractionResponseType.DeferredChannelMessageWithSource`（type 5）で即時応答
2. `unstable_after`（Next.js 15+）を使い、応答後に以下を非同期実行:
   a. `GET /webhooks/{appId}/{token}/messages/@original` で投稿メッセージIDを取得
   b. メッセージを「抽選開始」「リセット」ボタン付き内容に編集
   c. 各ロール絵文字をリアクションとして順次追加（6回 PUT）

メッセージ本文:

```txt
やれるロールのリアクションをしてください。
1️⃣ TOP
2️⃣ JG
3️⃣ MID
4️⃣ ADC
5️⃣ SUP
*️⃣ fill
```

ボタンの `custom_id`:

- 抽選開始: `CLIENT_ACTIONS.LOL.ROLE_ROULETTE_START`
- リセット: `CLIENT_ACTIONS.LOL.ROLE_ROULETTE_RESET`

> **Note:** メッセージID はボタンの `custom_id` に含めない。MESSAGE_COMPONENT インタラクション受信時に `interaction.channel_id` と `interaction.message.id` から取得できるため。

#### `handleRoleRouletteStart`（抽選開始ボタン押下時）

処理フロー:

1. `InteractionResponseType.DeferredChannelMessageWithSource`（type 5）で即時応答
2. `unstable_after` で非同期実行:
   a. `interaction.channel_id` と `interaction.message.id` を使い、各ロール絵文字のリアクションユーザーを取得（6回 GET）
   b. `runRoleRoulette()` を呼び出す
   c. エラーの場合: Ephemeral メッセージで `PATCH /webhooks/{appId}/{token}/messages/@original` に書き込む
   d. 成功の場合: 割り当て結果をフォーマットして `PATCH` で書き込む

結果フォーマット:

```txt
抽選結果：
TOP: <@userId>
JG: <@userId>
MID: <@userId>
ADC: <@userId>
SUP: <@userId>
休憩: [guild_member_name], [guild_member_name]  ← 5人超の場合のみ表示。休憩した人にはメンションされないように
```

#### `handleRoleRouletteReset`（リセットボタン押下時）

処理フロー:

1. `InteractionResponseType.DeferredUpdateMessage`（type 6）で即時応答（メッセージ変更なし）
2. `unstable_after` で非同期実行:
   a. `DELETE /channels/{channelId}/messages/{messageId}/reactions` で全リアクション削除
   b. 各ロール絵文字を順次再追加（6回 PUT）

### 6. ルーティング設定

**ファイル:** `my-app/app/api/discord/route.ts`

- `APPLICATION_COMMAND` ブロックに `COMMANDS.LOL.ROLE_ROULETTE` のケースを追加
- `MESSAGE_COMPONENT` ブロックに `CLIENT_ACTIONS.LOL.ROLE_ROULETTE_START`、`CLIENT_ACTIONS.LOL.ROLE_ROULETTE_RESET` のケースを追加

### 7. テスト方針

**ファイル:** `my-app/app/domains/lol/_server/roleRouletteRoulette.test.ts`

- `success:` 5人ちょうどで全員希望ロールが被らない場合に正しく割り当て
- `success:` fill参加者が任意のロールに割り当てられる
- `success:` 7人参加の場合、5人が割り当てられ2人が休憩に入る
- `failure:` あるロールに人間のリアクションがない場合のエラー
- `failure:` 参加者が4人以下の場合のエラー
- `failure:` 参加者は5人以上だが有効な割り当てが存在しない場合のエラー

## 技術選定

### 非同期処理: `unstable_after`

Discord Interaction は3秒以内の応答が必須。リアクションの追加・取得は複数回のAPI呼び出しが必要なため、Next.js 15+ の `unstable_after` を使い、レスポンス送信後に処理を実行する。

### 絵文字のAPIエンコード

Unicode 絵文字（例: `1️⃣`）はそのまま `encodeURIComponent()` でエンコードして Discord API エンドポイントのパスに埋め込む。

### 抽選アルゴリズム: ランダム化バックトラッキング

参加者数が最大でも数十人程度であるため、シンプルな再帰バックトラッキングで十分。
各試行前に参加者リスト・ロール順をシャッフルすることでランダム性を担保する。

## 参考資料

- [Discord API - Create Reaction](https://discord.com/developers/docs/resources/message#create-reaction)
- [Discord API - Delete All Reactions](https://discord.com/developers/docs/resources/message#delete-all-reactions)
- [Discord API - Get Reactions](https://discord.com/developers/docs/resources/message#get-reactions)
- [Next.js unstable_after](https://nextjs.org/docs/app/api-reference/functions/unstable_after)
