# `/lol-new-match` コマンドのレスポンス改善

## 目的

ユーザー体験を向上させるために、`/lol-new-match` コマンド実行後の「ブルーチーム」「レッドチーム」ボタンからのmodal_submitのレスポンスを改善する。
（共通処理であるWeb API `/api/web/lol/matches` も同時に改善される）

## 背景

### Issue #40 の要約

- **タイトル**: `/lol-new-match` コマンドの入力レスポンスに結果を記載する
- **URL**: <https://github.com/shari-sushi/discord-janken/issues/40>

- メインタスク
  1. モーダル送信後、登録した内容を**本人だけが確認できる** ephemeral メッセージを送信(レスポンス)
  2. 全員向けの通知メッセージも投稿（現在の形式を維持: `🟦 ブルーサイド登録完了 (登録者@xxx)`）
  3. つまり、Discord Interaction では **2つのメッセージ** を送信する必要がある
- サブタスク
  - 両チーム登録完了後、「リセット」「タイマーセット」ボタンを無効化する

### 現在の実装の問題点

**Discord Interaction の場合**: 登録者本人が自分の入力内容を確認できない（全員向けメッセージのみ）

**ファイル:** [newMatch.ts:353](my-app/app/api/discord/command/lol/newMatch.ts#L353)

```typescript
// 片方のチームのみ登録完了時
return {
  response: NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: teamSide === "blue_team"
        ? `🟦 ブルーサイド登録完了 (登録者<@${userId}>)`
        : `🟥 レッドサイド登録完了 (登録者<@${userId}>)`
    },
  }),
  isBothTeamsRegistered: false,
}
```

## 実装計画

### 1. Discord Interaction (`/lol-new-match` コマンド)

**目標:** 2つのメッセージを送信

1. ephemeral レスポンス（本人のみ、詳細）
2. 全員向けメッセージ（現在の形式を維持）

**変更箇所:** [newMatch.ts:235-358](my-app/app/api/discord/command/lol/newMatch.ts#L235-L358) の `handleRegisterTeam` 関数

#### ステップ1: ephemeral レスポンスで登録内容を返す

```typescript
// 片方のチームのみ登録完了時
return {
  response: NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: createRegistrationDetailMessage(teamSide, meta, usTeamData),
      flags: InteractionResponseFlags.EPHEMERAL  // ← 追加
    }
  }),
  isBothTeamsRegistered: false
}
```

**メッセージフォーマット（ephemeral）:**

```txt
✅ ブルーサイド登録完了

【プロテクト】
モルガナ、メル

【ロール振り分け】
Top: PlayerA
Jungle: PlayerB
Mid: PlayerC
ADC: PlayerD
Support: PlayerE
```

#### ステップ2: Follow-up で全員向けメッセージを送信（片方のチームのみ登録完了時）

**重要な仕様変更:**

- **片方のチームのみ登録時**: ephemeral レスポンス + Follow-up メッセージ
- **両チーム完了時（2チーム目登録時）**: ephemeralフラグなしのレスポンス（全員に見える） + Follow-upなし

Discord Interaction では、レスポンス後に Follow-up メッセージを送信できます。

```typescript
// Follow-up メッセージ送信（Discord Webhook を使用）
import { sendFollowupMessage } from "@/app/_server/lib/discord/api"

// 片方のチームのみ登録完了時: ephemeral レスポンスを返した後、Follow-up で全員向けメッセージを送信
if (!isBothRegistered) {
  await sendFollowupMessage(interactionToken, {
    content: teamSide === "blue_team"
      ? `🟦 ブルーサイド登録完了 (登録者<@${userId}>)`
      : `🟥 レッドサイド登録完了 (登録者<@${userId}>)`
  })
}

// 両チーム完了時: Follow-upメッセージは送らず、レスポンスで全員に見える形で結果発表
```

**技術的な注意点:**

- Follow-up メッセージは `interaction.token` を使って送信
- エンドポイント: `POST /webhooks/{application.id}/{interaction.token}`
- 15分以内に送信する必要がある
- 両チーム完了時は、結果発表を全員に見える形でレスポンスとして返すため、Follow-upは不要

**注意点:**

- 現在の Web API は試合作成時のみのレスポンスを返している
- チーム登録は Discord Interaction 経由でのみ行われるため、Web API 経由のチーム登録機能は未実装
- **この項目は将来的な拡張として計画に含めるが、Issue #40 の必須要件ではない可能性がある**

### 3. 共通ヘルパー関数の作成

`handleRegisterTeam` 関数内で使用する、登録内容を整形する関数を作成：

```typescript
/**
 * 登録内容の詳細メッセージを生成
 */
function createRegistrationDetailMessage(
  teamSide: TeamSide,
  meta: ProtectMatchMeta,
  teamData: ProtectTeamData
): string {
  const lines: string[] = []

  // ヘッダー
  lines.push(teamSide === "blue_team" ? "✅ ブルーサイド登録完了" : "✅ レッドサイド登録完了")
  lines.push("")

  // プロテクト
  if (meta.isProtect && teamData.protection_champions) {
    lines.push("【プロテクト】")
    lines.push(teamData.protection_champions)
    lines.push("")
  }

  // ロール振り分け
  if (meta.isRoleSelect && teamData.roster) {
    lines.push("【ロール振り分け】")
    lines.push(`Top: ${teamData.roster.top}`)
    lines.push(`Jungle: ${teamData.roster.jg}`)
    lines.push(`Mid: ${teamData.roster.mid}`)
    lines.push(`ADC: ${teamData.roster.adc}`)
    lines.push(`Support: ${teamData.roster.sup}`)
  }

  return lines.join("\n")
}
```

### 4. ボタン無効化機能（フォローアップ提案）

**目的:** 両チーム登録完了後、誤操作を防ぐために「リセット」「タイマーセット」ボタンを無効化する

**技術的な課題:**

Discord の Interaction Response では元のメッセージを直接更新できないため、以下の2つのアプローチを検討：

#### アプローチA: Discord REST API でメッセージを更新

```typescript
// 両チーム登録完了時
import { updateMessage } from "@/app/_server/lib/discord/api"

// 元のメッセージIDを使ってメッセージを更新
await updateMessage(channelId, messageId, {
  components: createProtectComponents(matchId, { disableButtons: true })
})
```

**必要な実装:**

- `updateMessage` 関数の追加（[discord/api.ts](my-app/app/_server/lib/discord/api.ts) に実装）
- `createProtectComponents` に `disableButtons` オプションを追加
- `messageId` と `channelId` の取得方法を確保

**メリット:**

- 明示的にボタンを無効化できる
- ユーザーに「発表が終わった」ことが視覚的に伝わる

**デメリット:**

- 追加の REST API 呼び出しが必要
- `channelId` の取得が必要

#### アプローチB: 状態管理でボタン押下時にエラーを返す

```typescript
// ボタン押下時にチェック
const [blueTeam, redTeam] = await redisMGet([
  getMatchKey(matchId, "blue_team"),
  getMatchKey(matchId, "red_team")
])

if (blueTeam && redTeam) {
  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "エラー: 両チーム登録済みのため、この操作はできません",
      flags: InteractionResponseFlags.EPHEMERAL
    }
  })
}
```

**メリット:**

- 実装がシンプル
- REST API 呼び出し不要

**デメリット:**

- ボタンは有効なまま表示される（見た目上の改善なし）
- ユーザーがボタンを押してから気づく

**推奨:** アプローチA（Discord REST API でメッセージ更新）

ユーザー体験を重視し、視覚的にもわかりやすいアプローチAを採用する。

## 技術選定

### 使用する Discord API

1. **Interaction Response Flags**
   - `InteractionResponseFlags.EPHEMERAL` (64)
   - 既に import 済み

2. **Follow-up Message（Webhook）**
   - エンドポイント: `POST /webhooks/{application.id}/{interaction.token}`
   - ドキュメント: <https://discord.com/developers/docs/interactions/receiving-and-responding#followup-messages>
   - Interaction Response の後に追加のメッセージを送信
   - `interaction.token` を使用（Bot Token 不要）
   - 15分以内に送信する必要がある

3. **Discord REST API - Edit Message**
   - エンドポイント: `PATCH /channels/{channel.id}/messages/{message.id}`
   - ドキュメント: <https://discord.com/developers/docs/resources/message#edit-message>
   - 必要なヘッダー: `Authorization: Bot {token}`
   - ボタン無効化機能で使用

### 実装ファイル

1. **[newMatch.ts](my-app/app/api/discord/command/lol/newMatch.ts)**
   - `handleRegisterTeam` 関数の修正（ephemeral レスポンス + Follow-up メッセージ送信）
   - `createRegistrationDetailMessage` 関数を追加（登録内容の整形）

2. **[discord/api.ts](my-app/app/_server/lib/discord/api.ts)** ※既存ファイルに追加
   - `sendFollowupMessage` 関数を追加（Follow-up メッセージ送信用）
   - `editDiscordMessage` 関数は既に存在（ボタン無効化機能で使用）

3. **[route.ts](my-app/app/api/discord/route.ts)**
   - `handleRegisterTeam` 呼び出し時に `interactionToken` を渡すための修正

4. **[protectMessageComponents.ts](my-app/app/api/discord/util/protectMessageComponents.ts)** ※ボタン無効化機能で使用
   - `createProtectComponents` 関数に `disableButtons` オプションを追加

## 参考資料

- [Discord Developer Portal - Message Components](https://discord.com/developers/docs/interactions/message-components)
- [Discord Developer Portal - Followup Messages](https://docs.discord.com/developers/interactions/receiving-and-responding#followup-messages)
- [Discord Developer Portal - Interaction Response](https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-data-structure)
- [discord-interactions - InteractionResponseFlags](https://github.com/discord/discord-interactions-js)

## 実装の優先順位

1. **必須（Issue #40 の要件）**
   - [x] ephemeral レスポンスへの変更
   - [x] 登録内容の表示

2. **推奨（フォローアップ提案）**
   - [x] ボタン無効化機能の実装

3. **オプション（将来的な改善）**
   - [ ] メッセージフォーマットの調整・デザイン改善

## 結合テスト計画

### テスト環境

- **テストフレームワーク**: Vitest
- **テストファイル**: `my-app/__tests__/integration/api/web/lol/match.test.ts` (新規作成)
- **テストスコープ**: プロテクトとロール振り分け両方ONに絞る（`isProtect: true`, `isRoleSelect: true`）
- **既存のモック設定**:
  - `discord-interactions` の `verifyKey` (署名検証は常に成功)
  - Redis (インメモリストアで代替)
- **追加で必要なモック**:
  - `@/app/_server/lib/discord/api` の `sendFollowupMessage`
  - `@/app/_server/lib/discord/api` の `editDiscordMessage`

### テストケース（4つに絞る）

#### 1. 正常系：通常のフロー（ブルーが先に登録）

**テストコード概要:**

```typescript
it("success: ブルー→レッドの順で登録、両チーム完了時に結果公開", async () => {
  // 1. コマンド実行 → ボタン付きメッセージ
  // 2. 青チームボタンクリック → モーダル送信（プロテクト + ロール振り分け）
  // 3. 赤チームボタンクリック → モーダル送信（プロテクト + ロール振り分け）

  // 期待値:
  // ■ 青チーム登録時（片方のチームのみ登録完了）
  //   - ephemeral レスポンス（flags: 64）
  //   - content に「✅ ブルーサイド登録完了」
  //   - content に「【プロテクト】」「【ロール振り分け】」セクション
  //   - sendFollowupMessage 呼び出し（1回目）
  //   - editDiscordMessage は呼ばれない
  //
  // ■ 赤チーム登録時（両チーム完了）
  //   - 全員に見える形のレスポンス（flags: undefined）
  //   - content に「✅ レッドサイド登録完了」
  //   - sendFollowupMessage は呼ばれない（合計1回のまま）
  //   - 両チーム完了の Embed メッセージ
  //   - editDiscordMessage 呼び出し（ボタン無効化）
})
```

**検証項目:**

- ✅ 青チーム登録時（片方のチームのみ登録完了）:
  - `response.data.flags === 64` (EPHEMERAL)
  - `response.data.content` に登録内容の詳細が含まれる
  - `sendFollowupMessage` が1回呼ばれる (`toHaveBeenCalledTimes(1)`)
  - 1回目の引数を確認 (`mock.calls[0]`)
  - `editDiscordMessage` は呼ばれない
- ✅ 赤チーム登録時（両チーム完了）:
  - `response.data.flags === undefined` (全員に見える形)
  - `response.data.content` に「✅ レッドサイド登録完了」が含まれる
  - `sendFollowupMessage` は呼ばれない（合計1回のまま）
  - 両チーム完了の Embed メッセージが返される
  - `editDiscordMessage` が1回呼ばれる
  - ブルー・レッドチームボタンが `disabled: true`
  - リセット・タイマーセットボタンは `disabled: false`

#### 2. 正常系：通常のフロー（レッドが先に登録）

**テストコード概要:**

```typescript
it("success: レッド→ブルーの順で登録、両チーム完了時にボタン無効化", async () => {
  // 1. コマンド実行 → ボタン付きメッセージ
  // 2. 赤チームボタンクリック → モーダル送信
  // 3. 青チームボタンクリック → モーダル送信

  // 期待値:
  // - テストケース1と同様の挙動（順序が逆）
})
```

**検証項目:**

- ✅ 赤チーム登録時（片方のチームのみ登録完了）:
  - ephemeral レスポンス
  - `response.data.content` に「✅ レッドサイド登録完了」が含まれる
  - Follow-up メッセージ送信
- ✅ 青チーム登録時（両チーム完了）:
  - 全員に見える形のレスポンス（ephemeralフラグなし）
  - Follow-up メッセージは送らない
  - 両チーム完了の Embed メッセージ
  - ボタン無効化

#### 3. 正常系：ブルーが先に登録し、その後再登録してからレッドが登録

**テストコード概要:**

```typescript
it("success: ブルー登録→ブルー再登録→レッド登録、最新データで完了", async () => {
  // 1. コマンド実行 → ボタン付きメッセージ
  // 2. 青チームボタンクリック → モーダル送信（1回目: データA）
  // 3. 青チームボタンクリック → モーダル送信（2回目: データB）
  // 4. 赤チームボタンクリック → モーダル送信

  // 期待値:
  // - 青チーム1回目: ephemeral + Follow-up
  // - 青チーム2回目: ephemeral + Follow-up（データBの内容）
  // - Redis に最新のデータB が保存される
  // - 赤チーム登録時（両チーム完了）: 全員に見える形の Embed にデータBが表示される
  // - sendFollowupMessage が2回呼ばれる（青チーム1回目、2回目のみ）
})
```

**検証項目:**

- ✅ 青チーム1回目の登録データが Redis に保存される
- ✅ 青チーム2回目の登録データで Redis が上書きされる
- ✅ 2回目の ephemeral レスポンスに最新の登録内容（データB）が含まれる
- ✅ 赤チーム登録時の Embed メッセージに青チームの最新データ（データB）が含まれる
- ✅ `sendFollowupMessage` が合計2回呼ばれる (`toHaveBeenCalledTimes(2)`)
  - 1回目: 青チーム1回目登録 (`mock.calls[0]`)
  - 2回目: 青チーム2回目登録 (`mock.calls[1]`)
  - 赤チーム登録時（両チーム完了）は Follow-up なし

#### 4. 正常系：ブルーが登録後、登録確認ボタンで期待通り確認できるか

**テストコード概要:**

```typescript
it("success: 青チーム登録後、確認ボタンで登録内容を確認できる", async () => {
  // 1. コマンド実行 → ボタン付きメッセージ
  // 2. 青チームボタンクリック → モーダル送信
  // 3. 「確認」ボタンクリック

  // 期待値:
  // - 確認ボタン押下時に ephemeral メッセージが表示される
  // - 青チームの登録済みかどうかが表示される(登録内容は表示されない)
  // - 赤チームは「未登録」と表示される
})
```

**検証項目:**

- ✅ 確認ボタン押下時のレスポンス:
  - `response.data.flags === 64` (EPHEMERAL)
  - `response.data.content` に青チームの登録内容が含まれる
  - `response.data.content` に赤チームが「未登録」として表示される

### テスト実装の優先順位

1. **必須（今回実装するテスト）**
   - [ ] 正常系：通常のフロー（ブルーが先に登録）
   - [ ] 正常系：通常のフロー（レッドが先に登録）
   - [ ] 正常系：ブルーが先に登録し、その後再登録してからレッドが登録
   - [ ] 正常系：ブルーが登録後、登録確認ボタンで期待通り確認できるか

2. **将来的な拡張（オプション）**
   - [ ] プロテクトOFF、ロール振り分けONの組み合わせテスト
   - [ ] プロテクトON、ロール振り分けOFFの組み合わせテスト
   - [ ] 両設定OFFのテスト
   - [ ] Discord API エラー時の挙動（Follow-up メッセージ送信失敗）
   - [ ] Discord API エラー時の挙動（メッセージ更新失敗）

### テスト実装の技術的な詳細

#### モックの設定方法

**ファイル**: `my-app/__tests__/integration/api/web/lol/match.test.ts`

```typescript
import { vi, beforeEach, describe, it, expect } from "vitest"
import * as discordApi from "@/app/_server/lib/discord/api"
import { POST as DiscordPOST } from "@/app/api/discord/route"
import { POST as WebPOST } from "@/app/api/web/lol/matches/route"
import { createButtonClickPayload, createModalSubmitPayload } from "@/__tests__/mocks/discord-payloads"
import { createDiscordRequest, parseJsonResponse } from "@/__tests__/helpers/api-test-utils"
import { InteractionResponseType, InteractionResponseFlags } from "discord-interactions"
import { extractMatchId } from "@/__tests__/helpers/discord-test-utils"
import { customId } from "@/app/api/discord/util/customId"
import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { NextRequest } from "next/server"

// Discord API 関数をモック化
const mockSendFollowupMessage = vi.fn().mockResolvedValue(undefined)
const mockEditDiscordMessage = vi.fn().mockResolvedValue(undefined)
const mockSendDiscordMessage = vi.fn().mockResolvedValue({
  id: "test-message-id",
  channel_id: "test-channel-id",
  content: "test"
})

beforeEach(() => {
  // 各テスト前にモックをリセット
  mockSendFollowupMessage.mockClear()
  mockEditDiscordMessage.mockClear()
  mockSendDiscordMessage.mockClear()

  // モック関数を設定（Promise を返す）
  vi.spyOn(discordApi, "sendFollowupMessage").mockImplementation(mockSendFollowupMessage)
  vi.spyOn(discordApi, "editDiscordMessage").mockImplementation(mockEditDiscordMessage)
  vi.spyOn(discordApi, "sendDiscordMessage").mockImplementation(mockSendDiscordMessage)
})
```

#### Web API を叩いて試合を作成し、matchId を取得する

```typescript
// Web API `/api/web/lol/matches` を呼び出して試合を作成
const blueTeamMembers = ["ｂ１", "ｂ２", "ｂ３", "ｂ４", "ｂ５"]
const redTeamMembers = ["ｒ１", "ｒ２", "ｒ３", "ｒ４", "ｒ５"]

const webApiRequest = new NextRequest("http://localhost/api/web/lol/matches", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer test-secret",
  },
  body: JSON.stringify({
    guild_id: "test-guild-id",
    channel_id: "test-channel-id",
    is_protect: true,
    is_role_select: true,
    members: {
      blue_team: blueTeamMembers,
      red_team: redTeamMembers,
    },
  }),
})

const webApiResponse = await WebPOST(webApiRequest)
expect(webApiResponse.status).toBe(200)

const webApiData = await webApiResponse.json()
expect(webApiData.success).toBe(true)

// sendDiscordMessage が呼ばれたことを確認
expect(mockSendDiscordMessage).toHaveBeenCalledTimes(1)

// 投稿されたメッセージから components を取得
const [channelId, content, components] = mockSendDiscordMessage.mock.calls[0]
expect(channelId).toBe("test-channel-id")
expect(content).toContain("プロテクトとロール")
expect(components).toBeDefined()

// ボタンの custom_id から matchId を抽出
const blueButtonCustomId: string = components[0]?.components[0]?.custom_id
expect(blueButtonCustomId).toBeDefined()
const matchId = extractMatchId(blueButtonCustomId)
expect(matchId).toBeTruthy()
expect(matchId).toBe(webApiData.match_id)
```

#### アサーションの例

```typescript
// ========================================
// 青チーム登録後の検証
// ========================================

// ephemeral フラグの確認
expect(blueResponse.data.flags).toBe(64) // InteractionResponseFlags.EPHEMERAL

// Follow-up メッセージ送信の確認（1回目）
expect(mockSendFollowupMessage).toHaveBeenCalledTimes(1)
expect(mockSendFollowupMessage.mock.calls[0]).toEqual([
  "test-interaction-token",
  "🟦 ブルーサイド登録完了 (登録者<@123456789012345678>)"
])

// メッセージ更新はまだ呼ばれない
expect(mockEditDiscordMessage).toHaveBeenCalledTimes(0)

// ========================================
// 赤チーム登録後の検証（両チーム完了）
// ========================================

// ephemeral フラグの確認
expect(redResponse.data.flags).toBe(64) // InteractionResponseFlags.EPHEMERAL

// Follow-up メッセージ送信の確認（合計2回）
expect(mockSendFollowupMessage).toHaveBeenCalledTimes(2)
expect(mockSendFollowupMessage.mock.calls[1]).toEqual([
  "test-interaction-token",
  "🟥 レッドサイド登録完了 (登録者<@123456789012345678>)"
])

// メッセージ更新の確認（ボタン無効化）
expect(mockEditDiscordMessage).toHaveBeenCalledTimes(1)
const [channelId, messageId, content, components] = mockEditDiscordMessage.mock.calls[0]
expect(channelId).toBe("test-channel-id")
expect(messageId).toBe("test-message-id")
expect(components[0].components[0].disabled).toBe(true) // ブルーチームボタン
expect(components[0].components[1].disabled).toBe(true) // レッドチームボタン
expect(components[1].components[0].disabled).toBe(false) // リセットボタン
expect(components[1].components[1].disabled).toBe(false) // タイマーセットボタン
```
