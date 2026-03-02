import { describe, it, expect } from "vitest"
import { POST } from "@/app/api/discord/route"
import { createNewMatchCommandPayload, createButtonClickPayload, createModalSubmitPayload } from "../../../mocks/discord-payloads"
import { createDiscordRequest, parseJsonResponse } from "../../../helpers/api-test-utils"
import { InteractionResponseType } from "discord-interactions"
import { extractMatchId } from "@/__tests__/helpers/discord-test-utils"
import { redisGet } from "@/app/_server/lib/redis/redis"
import { getMatchKey } from "@/app/domains/lol/_server/redisKeys"
import { ProtectMatchMeta, ProtectTeamData } from "@/app/domains/lol/types"
import { customId } from "@/app/api/discord/util/customId"
import { CLIENT_ACTIONS } from "@/app/_server/util/commands"

describe("Discord API - LOL New Match Integration Test (isProtect: true, isRoleSelect: false)", () => {
  it("success:青→赤→発表", async () => {
    // ① コマンド実行 → ボタン付きメッセージを返す
    const cmdRequest = createDiscordRequest(createNewMatchCommandPayload())
    const cmdResponse = await POST(cmdRequest)
    expect(cmdResponse.status).toBe(200)

    const cmdData = await parseJsonResponse(cmdResponse)
    expect(cmdData.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)
    expect(cmdData.data.content).toContain("プロテクト")
    expect(cmdData.data.components).toBeDefined()

    // ボタンのcustom_idからmatchIdを抽出
    const blueButtonCustomId: string = cmdData.data.components[0]?.components[0]?.custom_id
    expect(blueButtonCustomId).toBeDefined()

    const matchId = extractMatchId(blueButtonCustomId)
    expect(matchId).toBeTruthy()

    // メタデータが正しく保存されているか確認
    const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))
    expect(meta).toBeDefined()
    expect(meta?.match_id).toBe(matchId)
    expect(meta?.isProtect).toBe(true)
    expect(meta?.isRoleSelect).toBe(false)

    // ② 青チームのボタンをクリック → モーダルを返す
    const blueButtonPayload = createBlueTeamProtectButtonPayload(matchId)
    const blueButtonRequest = createDiscordRequest(blueButtonPayload)

    const blueButtonResponse = await POST(blueButtonRequest)
    expect(blueButtonResponse.status).toBe(200)

    const blueButtonData = await parseJsonResponse(blueButtonResponse)
    expect(blueButtonData.type).toBe(InteractionResponseType.MODAL)
    expect(blueButtonData.data.title).toContain("ブルーサイド")
    expect(blueButtonData.data.components).toBeDefined()
    expect(blueButtonData.data.components.length).toBeGreaterThan(0)

    // ③ 青チームのモーダルを送信 → Redisに保存
    const blueProtectChampion = "ポッピー、エズ"
    const blueModalPayload = createBlueTeamProtectModalPayload(matchId, blueProtectChampion)
    const blueModalRequest = createDiscordRequest(blueModalPayload)

    const blueModalResponse = await POST(blueModalRequest)
    const blueModalData = await parseJsonResponse(blueModalResponse)

    expect(blueModalResponse.status).toBe(200)
    expect(blueModalData.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)
    expect(blueModalData.data.content).toContain("登録完了")

    // 青チームのデータが保存されているか確認
    const blueTeamData = await redisGet<ProtectTeamData>(getMatchKey(matchId, "blue_team"))
    expect(blueTeamData).toBeDefined()
    expect(blueTeamData?.protection_champions).toBe(blueProtectChampion)

    // ④ 赤チームのボタンをクリック → モーダルを返す
    const redButtonPayload = createRedTeamProtectButtonPayload(matchId)
    const redButtonRequest = createDiscordRequest(redButtonPayload)

    const redButtonResponse = await POST(redButtonRequest)
    const redButtonData = await parseJsonResponse(redButtonResponse)

    expect(redButtonResponse.status).toBe(200)
    expect(redButtonData.type).toBe(InteractionResponseType.MODAL)
    expect(redButtonData.data.title).toContain("レッドサイド")

    // ⑤ 赤チームのモーダルを送信 → Redisに保存 & 両チーム完了のEmbedメッセージを返す
    const redProtectChampion = "アジール、ライズ"
    const redModalPayload = createRedTeamProtectModalPayload(matchId, redProtectChampion)
    const redModalRequest = createDiscordRequest(redModalPayload)

    const redModalResponse = await POST(redModalRequest)
    const redModalData = await parseJsonResponse(redModalResponse)

    expect(redModalResponse.status).toBe(200)
    expect(redModalData.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)

    // Embedメッセージの内容を確認
    expect(redModalData.data.embeds).toBeDefined()
    expect(redModalData.data.embeds.length).toBeGreaterThan(0)
    expect(redModalData.data.embeds[0].title).toContain("結果発表")

    // fieldsの内容を確認（3カラム形式）
    const fields = redModalData.data.embeds[0].fields
    expect(fields).toBeDefined()
    expect(fields.length).toBe(3) // 左カラム、ブルーサイド、レッドサイド

    // プロテクトデータが正しく表示されているか確認
    expect(fields[1].value).toContain(blueProtectChampion)
    expect(fields[2].value).toContain(redProtectChampion)

    // 赤チームのデータが保存されているか確認
    const redTeamData = await redisGet<ProtectTeamData>(getMatchKey(matchId, "red_team"))
    expect(redTeamData).toBeDefined()
    expect(redTeamData?.protection_champions).toBe(redProtectChampion)
  })
})

/**
 * 青チームプロテクトボタンクリック
 */
const createBlueTeamProtectButtonPayload = (matchId: string, messageId: string = "test-message-id") =>
  createButtonClickPayload(customId(CLIENT_ACTIONS.LOL.OPEN_MODAL_BLUE_TEAM_REGISTER).matchId(matchId), messageId)

/**
 * 赤チームプロテクトボタンクリック
 */
const createRedTeamProtectButtonPayload = (matchId: string, messageId: string = "test-message-id") =>
  createButtonClickPayload(customId(CLIENT_ACTIONS.LOL.OPEN_MODAL_RED_TEAM_REGISTER).matchId(matchId), messageId)

/**
 * 確認ボタンクリック
 */
// const createCheckRegisteredButtonPayload = (matchId: string) => createButtonClickPayload(customId(CLIENT_ACTIONS.LOL.CHECK_REGISTERED).matchId(matchId))

/**
 * リセットボタンクリック
 */
// const createResetRegisteredButtonPayload = (matchId: string) => createButtonClickPayload(customId(CLIENT_ACTIONS.LOL.RESET_REGISTERED).matchId(matchId))

/**
 * 青チームプロテクトモーダル送信
 */
const createBlueTeamProtectModalPayload = (matchId: string, protectChampion: string, messageId: string = "test-message-id") =>
  createModalSubmitPayload(`${CLIENT_ACTIONS.LOL.REGISTER_BLUE_TEAM}?match_id=${matchId}&message_id=${messageId}`, [
    {
      customId: customId("protection_champions").matchId(matchId),
      value: protectChampion,
    },
  ])

/**
 * 赤チームプロテクトモーダル送信
 */
const createRedTeamProtectModalPayload = (matchId: string, protectChampion: string, messageId: string = "test-message-id") =>
  createModalSubmitPayload(`${CLIENT_ACTIONS.LOL.REGISTER_RED_TEAM}?match_id=${matchId}&message_id=${messageId}`, [
    {
      customId: customId("protection_champions").matchId(matchId),
      value: protectChampion,
    },
  ])
