import { vi, beforeEach, describe, it, expect } from "vitest"
import * as discordApi from "@/app/_server/lib/discord/api"
import { POST as DiscordPOST } from "@/app/api/discord/route"
import { POST as WebPOST } from "@/app/api/web/lol/matches/route"
import { createButtonClickPayload, createModalSubmitPayload, mockMember1, mockMember2 } from "@/__tests__/mocks/discord-payloads"
import { createDiscordRequest, parseJsonResponse } from "@/__tests__/helpers/api-test-utils"
import { InteractionResponseType, InteractionResponseFlags } from "discord-interactions"
import { customId } from "@/app/api/discord/util/customId"
import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { redisGet } from "@/app/_server/lib/redis/redis"
import { getMatchKey } from "@/app/domains/lol/_server/redisKeys"
import { RegisteredTeamData } from "@/app/domains/lol/types"
import { NextRequest } from "next/server"
import { extractMatchId } from "@/__tests__/helpers/discord-test-utils"
import { createSession } from "@/app/_server/lib/session"
import { APIEmbed } from "discord-api-types/v10"

// Discord API 関数をモック化
const mockSendFollowupMessage = vi.fn().mockResolvedValue(undefined)
const mockEditDiscordMessage = vi.fn().mockResolvedValue(undefined)
const mockSendDiscordMessage = vi.fn().mockImplementation((channelId: string) => {
  return Promise.resolve({ id: "test-message-id", channel_id: channelId, content: "test" })
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

type ModalSubmitResponse = {
  type: number
  data: {
    content: string
    embeds: APIEmbed[]
    flags: number
  }
}

describe("Discord API - LOL New Match Response Improvement (isProtect: true, isRoleSelect: true)", () => {
  it("success: ブルー→レッドの順で登録、両チーム完了時に結果公開", async () => {
    const sessionToken = await createSession("test-user")

    // Web API `/api/web/lol/matches` を呼び出して試合を作成
    const CHANNEL_ID = "9876543210987654321"
    const blueTeamMembers = ["どらん", "おーなー", "ふぇいかー", "ぐまゆし", "けりあ"]
    const redTeamMembers = ["きなつ", "ふぉれすと", "りきゃっぷ", "さんばー", "らいな"]
    const webApiRequest = new NextRequest("http://localhost/api/web/lol/matches", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        guild_id: "1234567890123456789",
        channel_id: CHANNEL_ID,
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

    // 投稿されたメッセージの情報確認
    const [channelId, content, components] = mockSendDiscordMessage.mock.calls[0]
    expect(channelId).toBe(CHANNEL_ID)
    // my-app/app/api/web/lol/matches/route.ts で"プロテクトとロール"か"プロテクト"や"ロール"の片方だけのいずれかを生成している
    expect(content).toContain("プロテクトとロール")
    expect(components).toBeDefined()
    const blueButtonCustomId: string = components[0]?.components[0]?.custom_id
    expect(blueButtonCustomId).toBeDefined()
    const matchId = extractMatchId(blueButtonCustomId)
    expect(matchId).toBeDefined()
    expect(matchId).toBe(webApiData.match_id)

    // === テスト開始 ===
    // ① 青チームのボタンをクリック → モーダルを返す
    const blueButtonPayload = createBlueTeamButtonPayload(matchId, webApiData.message_id, channelId)
    const blueButtonRequest = createDiscordRequest(blueButtonPayload)
    const blueButtonResponse = await DiscordPOST(blueButtonRequest)
    expect(blueButtonResponse.status).toBe(200)

    const blueButtonData = (await parseJsonResponse(blueButtonResponse)) as ModalSubmitResponse
    expect(blueButtonData.type).toBe(InteractionResponseType.MODAL)

    // ② 青チームのモーダルを送信 → ephemeral レスポンス + Follow-up
    const blueProtectChampion = "モルガナ、メル"
    const blueRoster = {
      top: blueTeamMembers[0],
      jg: blueTeamMembers[1],
      mid: blueTeamMembers[2],
      adc: blueTeamMembers[3],
      sup: blueTeamMembers[4],
    }
    const blueModalPayload = createBlueTeamModalPayload(matchId, webApiData.message_id, blueProtectChampion, blueRoster, channelId)
    const blueModalRequest = createDiscordRequest(blueModalPayload)
    const blueModalResponse = await DiscordPOST(blueModalRequest)
    const blueModalData = (await parseJsonResponse(blueModalResponse)) as ModalSubmitResponse
    expect(blueModalResponse.status).toBe(200)
    expect(blueModalData.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)

    // ephemeral の content に登録内容の詳細が含まれる
    expect(blueModalData.data.flags).toBe(InteractionResponseFlags.EPHEMERAL)
    expect(blueModalData.data.content).toContain("✅ ブルーサイド登録完了")
    expect(blueModalData.data.content).toContain("【プロテクト】")
    expect(blueModalData.data.content).toContain(blueProtectChampion)
    expect(blueModalData.data.content).toContain("【ロール振り分け】")
    expect(blueModalData.data.content).toContain(`TOP: ${blueRoster.top}`)
    expect(blueModalData.data.content).toContain(`JG: ${blueRoster.jg}`)
    expect(blueModalData.data.content).toContain(`MID: ${blueRoster.mid}`)
    expect(blueModalData.data.content).toContain(`ADC: ${blueRoster.adc}`)
    expect(blueModalData.data.content).toContain(`SUP: ${blueRoster.sup}`)
    // 登録状況ステータスの確認
    expect(blueModalData.data.content).toContain("🟦 ブルーサイド：✅登録済")
    expect(blueModalData.data.content).toContain("🟥 レッドサイド：✍️未登録")

    // Follow-up メッセージが1回呼ばれる
    expect(mockSendFollowupMessage).toHaveBeenCalledTimes(1)
    expect(mockSendFollowupMessage.mock.calls[0]).toEqual(["test-interaction-token", `🟦 ブルーサイド登録完了 (登録者<@${mockMember1.user.id}>)`])

    // メッセージ更新はまだ呼ばれない
    expect(mockEditDiscordMessage).toHaveBeenCalledTimes(0)

    // 青チームのデータが保存されているか確認
    const blueTeamData = await redisGet<RegisteredTeamData>(getMatchKey(matchId, "blue_team"))
    expect(blueTeamData).toBeDefined()
    expect(blueTeamData?.protection_champions).toBe(blueProtectChampion)
    expect(blueTeamData?.roster?.top).toBe(blueRoster.top)

    // ④ 赤チームのボタンをクリック → モーダルを返す
    const redButtonPayload = createRedTeamButtonPayload(matchId, "test-message-id", channelId)
    const redButtonRequest = createDiscordRequest(redButtonPayload)
    const redButtonResponse = await DiscordPOST(redButtonRequest)
    expect(redButtonResponse.status).toBe(200)

    const redButtonData = (await parseJsonResponse(redButtonResponse)) as ModalSubmitResponse
    expect(redButtonData.type).toBe(InteractionResponseType.MODAL)

    // ⑤ 赤チームのモーダルを送信 → 全員に見える形で結果発表(Embed) + ボタン無効化。Follow-up無し。
    const redProtectChampion = "アジール、ライズ"
    const redRoster = {
      top: redTeamMembers[0],
      jg: redTeamMembers[1],
      mid: redTeamMembers[2],
      adc: redTeamMembers[3],
      sup: redTeamMembers[4],
    }
    const redModalPayload = createRedTeamModalPayload(matchId, "test-message-id", redProtectChampion, redRoster, channelId)
    const redModalRequest = createDiscordRequest(redModalPayload)
    const redModalResponse = await DiscordPOST(redModalRequest)
    const redModalData = (await parseJsonResponse(redModalResponse)) as ModalSubmitResponse

    expect(redModalResponse.status).toBe(200)
    expect(redModalData.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)

    // 全員に見える形（ephemeralフラグなし）
    expect(redModalData.data.flags).toBeUndefined()

    // content に登録内容の詳細が含まれる
    expect(redModalData.data.content).toContain("✅ レッドサイド登録完了")
    expect(redModalData.data.content).toContain("【プロテクト】")
    expect(redModalData.data.content).toContain(redProtectChampion)

    // Follow-up メッセージは1回のみ（青チーム登録時のみ、赤チーム登録時は送らない）
    expect(mockSendFollowupMessage).toHaveBeenCalledTimes(1)

    // 両チーム完了の Embed メッセージが返される
    expect(redModalData.data.embeds).toBeDefined()
    expect(redModalData.data.embeds.length).toBeGreaterThan(0)
    expect(redModalData.data.embeds[0].title).toContain("結果発表")

    // メッセージ更新が1回呼ばれる（ボタン無効化）
    expect(mockEditDiscordMessage).toHaveBeenCalledTimes(1)
    const [editChannelId, editMessageId, , editComponents] = mockEditDiscordMessage.mock.calls[0]
    expect(editChannelId).toBe(CHANNEL_ID)
    expect(editMessageId).toBe(webApiData.message_id)
    expect(editComponents).toBeDefined()
    expect(editComponents[0].components[0].disabled).toBe(true) // ブルーチームボタン
    expect(editComponents[0].components[1].disabled).toBe(true) // レッドチームボタン
    expect(editComponents[0].components[3].disabled).toBe(true) // リセットボタン
    expect(editComponents[0].components[4].disabled).toBe(true) // タイマーセットボタン
  })

  it("success: レッド→ブルーの順で登録、両チーム完了時にボタン無効化", async () => {
    // === セットアップ ===
    // セッションを作成して認証トークンを取得
    const sessionToken = await createSession("test-user")

    // Web API を叩いて試合を作成
    const CHANNEL_ID = "9876543210987654321"
    const blueTeamMembers = ["どらん", "おーなー", "ふぇいかー", "ぐまゆし", "けりあ"]
    const redTeamMembers = ["きなつ", "ふぉれすと", "りきゃっぷ", "さんばー", "らいな"]
    const webApiRequest = new NextRequest("http://localhost/api/web/lol/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        guild_id: "1234567890123456789",
        channel_id: CHANNEL_ID,
        is_protect: true,
        is_role_select: true,
        members: { blue_team: blueTeamMembers, red_team: redTeamMembers },
      }),
    })

    const webApiResponse = await WebPOST(webApiRequest)
    const webApiData = await webApiResponse.json()
    const [channelId, , components] = mockSendDiscordMessage.mock.calls[0]
    const matchId = extractMatchId(components[0]?.components[0]?.custom_id)

    // ② 赤チームのボタンをクリック → モーダルを返す
    const redButtonPayload = createRedTeamButtonPayload(matchId, webApiData.message_id, channelId)
    const redButtonRequest = createDiscordRequest(redButtonPayload)
    const redButtonResponse = await DiscordPOST(redButtonRequest)
    expect(redButtonResponse.status).toBe(200)

    // ③ 赤チームのモーダルを送信 → ephemeral レスポンス + Follow-up
    const redProtectChampion = "アジール、ライズ"
    const redRoster = {
      top: redTeamMembers[0],
      jg: redTeamMembers[1],
      mid: redTeamMembers[2],
      adc: redTeamMembers[3],
      sup: redTeamMembers[4],
    }
    const redModalPayload = createRedTeamModalPayload(matchId, webApiData.message_id, redProtectChampion, redRoster, channelId)
    const redModalRequest = createDiscordRequest(redModalPayload)
    const redModalResponse = await DiscordPOST(redModalRequest)
    const redModalData = (await parseJsonResponse(redModalResponse)) as ModalSubmitResponse

    expect(redModalResponse.status).toBe(200)
    expect(redModalData.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)

    // ephemeral フラグの確認
    expect(redModalData.data.flags).toBe(InteractionResponseFlags.EPHEMERAL)
    expect(redModalData.data.content).toContain("✅ レッドサイド登録完了")
    expect(redModalData.data.content).toContain("【プロテクト】")
    expect(redModalData.data.content).toContain(redProtectChampion)
    expect(redModalData.data.content).toContain("【ロール振り分け】")
    expect(redModalData.data.content).toContain(`TOP: ${redRoster.top}`)
    expect(redModalData.data.content).toContain(`JG: ${redRoster.jg}`)
    expect(redModalData.data.content).toContain(`MID: ${redRoster.mid}`)
    expect(redModalData.data.content).toContain(`ADC: ${redRoster.adc}`)
    expect(redModalData.data.content).toContain(`SUP: ${redRoster.sup}`)
    // 登録状況ステータスの確認
    expect(redModalData.data.content).toContain("🟦 ブルーサイド：✍️未登録")
    expect(redModalData.data.content).toContain("🟥 レッドサイド：✅登録済")

    // Follow-up メッセージが1回呼ばれる
    expect(mockSendFollowupMessage).toHaveBeenCalledTimes(1)
    expect(mockSendFollowupMessage.mock.calls[0]).toEqual(["test-interaction-token", "🟥 レッドサイド登録完了 (登録者<@123456789012345678>)"])

    // メッセージ更新はまだ呼ばれない
    expect(mockEditDiscordMessage).toHaveBeenCalledTimes(0)

    // ④ 青チームのボタンをクリック → モーダルを返す
    const blueButtonPayload = createBlueTeamButtonPayload(matchId, webApiData.message_id, channelId)
    const blueButtonRequest = createDiscordRequest(blueButtonPayload)
    const blueButtonResponse = await DiscordPOST(blueButtonRequest)
    expect(blueButtonResponse.status).toBe(200)

    // ⑤ 青チームのモーダルを送信 → 全員に見える形で結果発表(Embed) + ボタン無効化。Follow-up無し。
    const blueProtectChampion = "モルガナ、メル"
    const blueRoster = {
      top: blueTeamMembers[0],
      jg: blueTeamMembers[1],
      mid: blueTeamMembers[2],
      adc: blueTeamMembers[3],
      sup: blueTeamMembers[4],
    }
    const blueModalPayload = createBlueTeamModalPayload(matchId, webApiData.message_id, blueProtectChampion, blueRoster, channelId)
    const blueModalRequest = createDiscordRequest(blueModalPayload)
    const blueModalResponse = await DiscordPOST(blueModalRequest)
    const blueModalData = (await parseJsonResponse(blueModalResponse)) as ModalSubmitResponse

    expect(blueModalResponse.status).toBe(200)
    expect(blueModalData.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)

    // 全員に見える形（ephemeralフラグなし）
    expect(blueModalData.data.flags).toBeUndefined()
    expect(blueModalData.data.content).toContain("✅ ブルーサイド登録完了")

    // Follow-up メッセージは1回のみ（赤チーム登録時のみ、青チーム登録時は送らない）
    expect(mockSendFollowupMessage).toHaveBeenCalledTimes(1)

    // 両チーム完了の Embed メッセージが返される
    expect(blueModalData.data.embeds).toBeDefined()
    expect(blueModalData.data.embeds[0].title).toContain("結果発表")

    // メッセージ更新が1回呼ばれる（ボタン無効化）
    expect(mockEditDiscordMessage).toHaveBeenCalledTimes(1)
    const [editChannelId2, editMessageId2, , editComponents2] = mockEditDiscordMessage.mock.calls[0]
    expect(editChannelId2).toBe(CHANNEL_ID)
    expect(editMessageId2).toBe(webApiData.message_id)
    expect(editComponents2[0].components[0].disabled).toBe(true) // ブルーチームボタン
    expect(editComponents2[0].components[1].disabled).toBe(true) // レッドチームボタン
  })

  it("success: ブルー登録→ブルー再登録→レッド登録、最新データで完了", async () => {
    // === セットアップ ===
    // セッションを作成して認証トークンを取得
    const sessionToken = await createSession("test-user")

    // Web API を叩いて試合を作成
    const CHANNEL_ID = "9876543210987654321"
    const blueTeamMembers = ["どらん", "おーなー", "ふぇいかー", "ぐまゆし", "けりあ"]
    const redTeamMembers = ["きなつ", "ふぉれすと", "りきゃっぷ", "さんばー", "らいな"]
    const webApiRequest = new NextRequest("http://localhost/api/web/lol/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        guild_id: "1234567890123456789",
        channel_id: CHANNEL_ID,
        is_protect: true,
        is_role_select: true,
        members: { blue_team: blueTeamMembers, red_team: redTeamMembers },
      }),
    })

    const webApiResponse = await WebPOST(webApiRequest)
    const webApiData = await webApiResponse.json()
    const [channelId, , components] = mockSendDiscordMessage.mock.calls[0]
    const matchId = extractMatchId(components[0]?.components[0]?.custom_id)

    // ② 青チームのボタンをクリック → モーダルを返す
    const blueButtonPayload = createBlueTeamButtonPayload(matchId, webApiData.message_id, channelId)
    const blueButtonRequest = createDiscordRequest(blueButtonPayload)
    await DiscordPOST(blueButtonRequest)

    // ③ 青チームのモーダルを送信（1回目: データA）
    const blueProtectChampionA = "データA: チャンピオンA"
    const blueRosterA = {
      top: blueTeamMembers[0],
      jg: blueTeamMembers[1],
      mid: blueTeamMembers[2],
      adc: blueTeamMembers[3],
      sup: blueTeamMembers[4],
    }
    const blueModalPayloadA = createBlueTeamModalPayload(matchId, webApiData.message_id, blueProtectChampionA, blueRosterA, channelId)
    const blueModalRequestA = createDiscordRequest(blueModalPayloadA)
    const blueModalResponseA = await DiscordPOST(blueModalRequestA)
    const blueModalDataA = (await parseJsonResponse(blueModalResponseA)) as ModalSubmitResponse

    expect(blueModalResponseA.status).toBe(200)
    expect(blueModalDataA.data.flags).toBe(InteractionResponseFlags.EPHEMERAL)
    expect(blueModalDataA.data.content).toContain(blueProtectChampionA)
    expect(blueModalDataA.data.content).toContain("🟦 ブルーサイド：✅登録済")
    expect(blueModalDataA.data.content).toContain("🟥 レッドサイド：✍️未登録")

    // Follow-up メッセージが1回呼ばれる
    expect(mockSendFollowupMessage).toHaveBeenCalledTimes(1)

    // 青チーム1回目の登録データが Redis に保存される
    let blueTeamData = await redisGet<RegisteredTeamData>(getMatchKey(matchId, "blue_team"))
    expect(blueTeamData?.protection_champions).toBe(blueProtectChampionA)
    expect(blueTeamData?.roster?.top).toBe(blueRosterA.top)

    // ④ 青チームのボタンを再度クリック → モーダルを返す
    const blueButtonPayload2 = createBlueTeamButtonPayload(matchId, webApiData.message_id, channelId)
    const blueButtonRequest2 = createDiscordRequest(blueButtonPayload2)
    await DiscordPOST(blueButtonRequest2)

    // ⑤ 青チームのモーダルを送信（2回目: データB）
    const blueProtectChampionB = "データB: チャンピオンB"
    const blueRosterB = {
      top: blueTeamMembers[4], // 再登録時は異なる割り当てをテスト
      jg: blueTeamMembers[0],
      mid: blueTeamMembers[1],
      adc: blueTeamMembers[2],
      sup: blueTeamMembers[3],
    }
    const blueModalPayloadB = createBlueTeamModalPayload(matchId, webApiData.message_id, blueProtectChampionB, blueRosterB, channelId)
    const blueModalRequestB = createDiscordRequest(blueModalPayloadB)
    const blueModalResponseB = await DiscordPOST(blueModalRequestB)
    const blueModalDataB = (await parseJsonResponse(blueModalResponseB)) as ModalSubmitResponse

    expect(blueModalResponseB.status).toBe(200)
    expect(blueModalDataB.data.flags).toBe(InteractionResponseFlags.EPHEMERAL)
    expect(blueModalDataB.data.content).toContain(blueProtectChampionB)
    expect(blueModalDataB.data.content).toContain("🟦 ブルーサイド：✅登録済")
    expect(blueModalDataB.data.content).toContain("🟥 レッドサイド：✍️未登録")

    // Follow-up メッセージが2回呼ばれる
    expect(mockSendFollowupMessage).toHaveBeenCalledTimes(2)

    // 青チーム2回目の登録データで Redis が上書きされる
    blueTeamData = await redisGet<RegisteredTeamData>(getMatchKey(matchId, "blue_team"))
    expect(blueTeamData?.protection_champions).toBe(blueProtectChampionB)
    expect(blueTeamData?.roster?.top).toBe(blueRosterB.top)

    // ⑥ 赤チームのボタンをクリック → モーダルを返す
    const redButtonPayload = createRedTeamButtonPayload(matchId, webApiData.message_id, channelId)
    const redButtonRequest = createDiscordRequest(redButtonPayload)
    await DiscordPOST(redButtonRequest)

    // ⑦ 赤チームのモーダルを送信 → 両チーム完了の Embed に青チームの最新データ（データB）が含まれる
    const redProtectChampion = "レッドチャンピオン"
    const redRoster = {
      top: redTeamMembers[0],
      jg: redTeamMembers[1],
      mid: redTeamMembers[2],
      adc: redTeamMembers[3],
      sup: redTeamMembers[4],
    }
    const redModalPayload = createRedTeamModalPayload(matchId, webApiData.message_id, redProtectChampion, redRoster, channelId)
    const redModalRequest = createDiscordRequest(redModalPayload)
    const redModalResponse = await DiscordPOST(redModalRequest)
    const redModalData = (await parseJsonResponse(redModalResponse)) as ModalSubmitResponse

    expect(redModalResponse.status).toBe(200)

    // Follow-up メッセージが合計2回呼ばれる（青チーム1回目、青チーム2回目のみ。赤チーム登録時は送らない）
    expect(mockSendFollowupMessage).toHaveBeenCalledTimes(2)
    expect(mockSendFollowupMessage.mock.calls[0][1]).toContain("🟦 ブルーサイド登録完了")
    expect(mockSendFollowupMessage.mock.calls[1][1]).toContain("🟦 ブルーサイド登録完了")

    // 両チーム完了の Embed メッセージに青チームの最新データ（データB）が含まれる
    expect(redModalData.data.embeds).toBeDefined()
    expect(redModalData.data.embeds[0].title).toContain("結果発表")
    const blueField = redModalData.data.embeds[0].fields![1] // fields[1] がブルーサイド
    expect(blueField?.value).toContain(blueProtectChampionB) // 青チームの最新データ
    expect(blueField?.value).toContain(blueRosterB.top) // 青チームの最新ロール振り分け
  })

  it("failure: 不正なプレイヤー名を含むロール振り分けでエラーが発生する", async () => {
    // === セットアップ ===
    // セッションを作成して認証トークンを取得
    const sessionToken = await createSession("test-user")

    // Web API を叩いて試合を作成
    const CHANNEL_ID = "9876543210987654321"
    const blueTeamMembers = ["どらん", "おーなー", "ふぇいかー", "ぐまゆし", "けりあ"]
    const redTeamMembers = ["きなつ", "ふぉれすと", "りきゃっぷ", "さんばー", "らいな"]
    const webApiRequest = new NextRequest("http://localhost/api/web/lol/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        guild_id: "1234567890123456789",
        channel_id: CHANNEL_ID,
        is_protect: true,
        is_role_select: true,
        members: { blue_team: blueTeamMembers, red_team: redTeamMembers },
      }),
    })

    const webApiResponse = await WebPOST(webApiRequest)
    const webApiData = await webApiResponse.json()
    const [channelId, , components] = mockSendDiscordMessage.mock.calls[0]
    const matchId = extractMatchId(components[0]?.components[0]?.custom_id)

    // ② 青チームのボタンをクリック → モーダルを返す
    const blueButtonPayload = createBlueTeamButtonPayload(matchId, webApiData.message_id, channelId)
    const blueButtonRequest = createDiscordRequest(blueButtonPayload)
    await DiscordPOST(blueButtonRequest)

    // ③ 青チームのモーダルを送信（1メンバーだけ不正な名前）
    const blueProtectChampion = "モルガナ、メル"
    const blueRoster = {
      top: blueTeamMembers[0] + "aaaa", // 不正なプレイヤー名
      jg: blueTeamMembers[1],
      mid: blueTeamMembers[2],
      adc: blueTeamMembers[3],
      sup: blueTeamMembers[4],
    }
    const blueModalPayload = createBlueTeamModalPayload(matchId, webApiData.message_id, blueProtectChampion, blueRoster, channelId)
    const blueModalRequest = createDiscordRequest(blueModalPayload)
    const blueModalResponse = await DiscordPOST(blueModalRequest)
    const blueModalData = (await parseJsonResponse(blueModalResponse)) as ModalSubmitResponse

    // エラーレスポンスが返されることを確認
    expect(blueModalResponse.status).toBe(200)
    expect(blueModalData.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)
    expect(blueModalData.data.flags).toBe(InteractionResponseFlags.EPHEMERAL)
    expect(blueModalData.data.content).toContain("データの不整合が発生しました")
  })

  it("success: 青チーム登録後、確認ボタンで登録内容を確認できる", async () => {
    // === セットアップ ===
    // セッションを作成して認証トークンを取得
    const sessionToken = await createSession("test-user")

    // Web API を叩いて試合を作成
    const CHANNEL_ID = "9876543210987654321"
    const blueTeamMembers = ["どらん", "おーなー", "ふぇいかー", "ぐまゆし", "けりあ"]
    const redTeamMembers = ["きなつ", "ふぉれすと", "りきゃっぷ", "さんばー", "らいな"]
    const webApiRequest = new NextRequest("http://localhost/api/web/lol/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        guild_id: "1234567890123456789",
        channel_id: CHANNEL_ID,
        is_protect: true,
        is_role_select: true,
        members: { blue_team: blueTeamMembers, red_team: redTeamMembers },
      }),
    })

    const webApiResponse = await WebPOST(webApiRequest)
    const webApiData = await webApiResponse.json()
    const [channelId, , components] = mockSendDiscordMessage.mock.calls[0]
    const matchId = extractMatchId(components[0]?.components[0]?.custom_id)

    // ② 青チームのボタンをクリック → モーダルを返す
    const blueButtonPayload = createBlueTeamButtonPayload(matchId, webApiData.message_id, channelId)
    const blueButtonRequest = createDiscordRequest(blueButtonPayload)
    await DiscordPOST(blueButtonRequest)

    // ③ 青チームのモーダルを送信
    const blueProtectChampion = "モルガナ、メル"
    const blueRoster = {
      top: blueTeamMembers[0],
      jg: blueTeamMembers[1],
      mid: blueTeamMembers[2],
      adc: blueTeamMembers[3],
      sup: blueTeamMembers[4],
    }
    const blueModalPayload = createBlueTeamModalPayload(matchId, webApiData.message_id, blueProtectChampion, blueRoster, channelId)
    const blueModalRequest = createDiscordRequest(blueModalPayload)
    await DiscordPOST(blueModalRequest)

    // ④ 「確認」ボタンをクリック
    const checkButtonPayload = createCheckRegisteredButtonPayload(matchId, webApiData.message_id, channelId)
    const checkButtonRequest = createDiscordRequest(checkButtonPayload)
    const checkButtonResponse = await DiscordPOST(checkButtonRequest)
    const checkButtonData = (await parseJsonResponse(checkButtonResponse)) as ModalSubmitResponse

    expect(checkButtonResponse.status).toBe(200)
    expect(checkButtonData.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)

    // ephemeral フラグの確認
    expect(checkButtonData.data.flags).toBe(InteractionResponseFlags.EPHEMERAL)

    // 青チームが登録済みであることが表示される
    expect(checkButtonData.data.content).toContain("ブルーサイド")
    expect(checkButtonData.data.content).toContain("登録済み")

    // 赤チームが未登録であることが表示される
    expect(checkButtonData.data.content).toContain("レッドサイド")
    expect(checkButtonData.data.content).toContain("未登録")
  })
})

/**
 * 青チームボタンクリック（channel_idを指定可能）
 */
const createBlueTeamButtonPayload = (matchId: string, messageId: string = "test-message-id", channelId: string) => {
  const payload = createButtonClickPayload(customId(CLIENT_ACTIONS.LOL.OPEN_MODAL_BLUE_TEAM_REGISTER).matchId(matchId), messageId, mockMember1)
  return { ...payload, channel_id: channelId }
}

/**
 * 赤チームボタンクリック（channel_idを指定可能）
 */
const createRedTeamButtonPayload = (matchId: string, messageId: string = "test-message-id", channelId: string) => {
  const payload = createButtonClickPayload(customId(CLIENT_ACTIONS.LOL.OPEN_MODAL_RED_TEAM_REGISTER).matchId(matchId), messageId, mockMember2)
  return { ...payload, channel_id: channelId }
}

/**
 * 確認ボタンクリック（channel_idを指定可能）
 */
const createCheckRegisteredButtonPayload = (matchId: string, messageId: string = "test-message-id", channelId: string) => {
  const payload = createButtonClickPayload(customId(CLIENT_ACTIONS.LOL.CHECK_REGISTERED).matchId(matchId), messageId, mockMember1)
  return { ...payload, channel_id: channelId }
}

/**
 * 青チームモーダル送信（プロテクト + ロール振り分け）
 */
const createBlueTeamModalPayload = (matchId: string, messageId: string, protectChampion: string, roster: { top: string; jg: string; mid: string; adc: string; sup: string }, channelId: string) => {
  const payload = createModalSubmitPayload(`${CLIENT_ACTIONS.LOL.REGISTER_BLUE_TEAM}?match_id=${matchId}&message_id=${messageId}`, [
    {
      customId: customId("protection_champions").matchId(matchId),
      value: protectChampion,
    },
    {
      customId: customId("role_top").matchId(matchId),
      value: roster.top,
    },
    {
      customId: customId("role_jg").matchId(matchId),
      value: roster.jg,
    },
    {
      customId: customId("role_mid").matchId(matchId),
      value: roster.mid,
    },
    {
      customId: customId("role_adc").matchId(matchId),
      value: roster.adc,
    },
    {
      customId: customId("role_sup").matchId(matchId),
      value: roster.sup,
    },
  ])
  return { ...payload, channel_id: channelId, channel: { id: channelId } }
}

/**
 * 赤チームモーダル送信（プロテクト + ロール振り分け）
 */
const createRedTeamModalPayload = (matchId: string, messageId: string, protectChampion: string, roster: { top: string; jg: string; mid: string; adc: string; sup: string }, channelId: string) => {
  const payload = createModalSubmitPayload(
    `${CLIENT_ACTIONS.LOL.REGISTER_RED_TEAM}?match_id=${matchId}&message_id=${messageId}`,
    [
      { customId: customId("protection_champions").matchId(matchId), value: protectChampion },
      { customId: customId("role_top").matchId(matchId), value: roster.top },
      { customId: customId("role_jg").matchId(matchId), value: roster.jg },
      { customId: customId("role_mid").matchId(matchId), value: roster.mid },
      { customId: customId("role_adc").matchId(matchId), value: roster.adc },
      { customId: customId("role_sup").matchId(matchId), value: roster.sup },
    ],
    mockMember2,
  )
  return { ...payload, channel_id: channelId, channel: { id: channelId } }
}
