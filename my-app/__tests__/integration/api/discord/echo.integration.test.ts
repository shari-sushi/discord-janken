import { describe, it, expect, beforeAll } from "vitest"
import { POST } from "@/app/api/discord/route"
import { createEchoCommandPayload, createPingPayload } from "../../../mocks/discord-payloads"
import { createDiscordRequest, parseJsonResponse } from "../../../helpers/api-test-utils"
import { InteractionResponseType } from "discord-interactions"

describe("Discord API - Echo Command Integration Test", () => {
  beforeAll(() => {
    // テスト環境の設定（setup.tsで設定済み）
  })

  it("success:PING リクエストに PONG を返す", async () => {
    const payload = createPingPayload()
    const request = createDiscordRequest(payload)

    const response = await POST(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.type).toBe(InteractionResponseType.PONG)
  })

  it("success:echoコマンドは入力されたテキストをそのまま返す", async () => {
    const testMessage = "こんにちは、テストです！"
    const payload = createEchoCommandPayload(testMessage)
    const request = createDiscordRequest(payload)

    const response = await POST(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)
    expect(data.data.content).toBe(testMessage)
  })

  // discordのoptionの規約的に空で返していいのか…？実動上は問題無い&echoコマンドに時間割きたくないので放置
  it("success:echoコマンドでテキストが空の場合、空文字列を返す", async () => {
    const payload = createEchoCommandPayload("")
    const request = createDiscordRequest(payload)

    const response = await POST(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE)
    expect(data.data.content).toBe("")
  })
})
