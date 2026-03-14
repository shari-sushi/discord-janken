import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "@/app/api/discord/route"
import { createMentionReactorsCommandPayload } from "../../../mocks/discord-payloads"
import { createDiscordRequest, parseJsonResponse } from "../../../helpers/api-test-utils"
import * as discordApi from "@/app/_server/lib/discord/api"
import { InteractionResponseType, MessageFlags } from "discord-api-types/v10"

// Discord API関数をモック化
vi.mock("@/app/_server/lib/discord/api", async () => {
  const actual = await vi.importActual("@/app/_server/lib/discord/api")
  return {
    ...actual,
    getDiscordMessage: vi.fn(),
    getAllReactionFields: vi.fn(),
  }
})

describe("Discord API - /user-mention-reactors Command Integration Test", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("success: 正しいメッセージリンクとリアクションがある場合、Embedで返す", async () => {
    const messageLink = "https://discord.com/channels/123456789/987654321/111222333"

    // getDiscordMessageのモック
    const mockGetDiscordMessage = vi.mocked(discordApi.getDiscordMessage)
    mockGetDiscordMessage.mockResolvedValue({
      id: "111222333",
      channel_id: "987654321",
      content: "これはテストメッセージです",
      author: {
        id: "author-id",
        username: "author",
        discriminator: "0001",
        avatar: null,
      },
      timestamp: "2024-01-01T00:00:00.000Z",
      reactions: [
        {
          count: 2,
          me: false,
          emoji: {
            id: null,
            name: "👍",
          },
        },
      ],
    })

    // getAllReactionFieldsのモック
    const mockGetAllReactionFields = vi.mocked(discordApi.getAllReactionFields)
    mockGetAllReactionFields.mockResolvedValue([
      {
        emojiName: "👍",
        count: 2,
        userIds: ["user1", "user2"],
      },
    ])

    const payload = createMentionReactorsCommandPayload(messageLink)
    const request = createDiscordRequest(payload)

    const response = await POST(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.type).toBe(InteractionResponseType.ChannelMessageWithSource)
    expect(data.data.embeds).toBeDefined()
    expect(data.data.embeds).toHaveLength(1)

    const embed = data.data.embeds[0]
    expect(embed.title).toBe("リアクションメンバー")
    expect(embed.description).toContain("これはテストメッセージです")
    expect(embed.fields).toHaveLength(1)
    expect(embed.fields[0].name).toBe("👍 (2)")
    expect(embed.fields[0].value).toBe("<@user1> <@user2>")
    expect(embed.footer.text).toContain("Created by")
    expect(embed.color).toBe(0x5865f2)

    // API呼び出しの検証
    expect(mockGetDiscordMessage).toHaveBeenCalledTimes(1)
    expect(mockGetDiscordMessage).toHaveBeenCalledWith("987654321", "111222333")
    expect(mockGetAllReactionFields).toHaveBeenCalledTimes(1)
    expect(mockGetAllReactionFields).toHaveBeenCalledWith("987654321", "111222333", [
      {
        count: 2,
        me: false,
        emoji: {
          id: null,
          name: "👍",
        },
      },
    ])
  })

  it("failure: 不正なメッセージリンクの場合、エラーメッセージを返す", async () => {
    const invalidLink = "https://example.com/invalid/link"
    const payload = createMentionReactorsCommandPayload(invalidLink)
    const request = createDiscordRequest(payload)

    const response = await POST(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.type).toBe(InteractionResponseType.ChannelMessageWithSource)
    expect(data.data.content).toContain("不正なメッセージリンクです")
    expect(data.data.flags).toBe(MessageFlags.Ephemeral)
  })

  it("failure: リアクションがない場合、エラーメッセージを返す", async () => {
    const messageLink = "https://discord.com/channels/123456789/987654321/111222333"

    // リアクションがないメッセージを返すモック
    const mockGetDiscordMessage = vi.mocked(discordApi.getDiscordMessage)
    mockGetDiscordMessage.mockResolvedValue({
      id: "111222333",
      channel_id: "987654321",
      content: "リアクションなしのメッセージ",
      author: {
        id: "author-id",
        username: "author",
        discriminator: "0001",
        avatar: null,
      },
      timestamp: "2024-01-01T00:00:00.000Z",
      reactions: [],
    })

    const payload = createMentionReactorsCommandPayload(messageLink)
    const request = createDiscordRequest(payload)

    const response = await POST(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.type).toBe(InteractionResponseType.ChannelMessageWithSource)
    expect(data.data.content).toContain("リアクションがありません")
    expect(data.data.flags).toBe(MessageFlags.Ephemeral)
  })

  it("failure: メッセージが見つからない場合、エラーメッセージを返す", async () => {
    const messageLink = "https://discord.com/channels/123456789/987654321/999999999"

    // API エラーをモック
    const mockGetDiscordMessage = vi.mocked(discordApi.getDiscordMessage)
    mockGetDiscordMessage.mockRejectedValue(new Error("Message not found"))

    const payload = createMentionReactorsCommandPayload(messageLink)
    const request = createDiscordRequest(payload)

    const response = await POST(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.type).toBe(InteractionResponseType.ChannelMessageWithSource)
    expect(data.data.content).toContain("メッセージまたはリアクション情報の取得に失敗しました")
    expect(data.data.flags).toBe(MessageFlags.Ephemeral)
  })

  it("success: カスタム絵文字のリアクションも正しく処理できる", async () => {
    const messageLink = "https://discord.com/channels/123456789/987654321/111222333"

    // カスタム絵文字のリアクションを含むメッセージ
    const mockGetDiscordMessage = vi.mocked(discordApi.getDiscordMessage)
    mockGetDiscordMessage.mockResolvedValue({
      id: "111222333",
      channel_id: "987654321",
      content: "カスタム絵文字テスト",
      author: {
        id: "author-id",
        username: "author",
        discriminator: "0001",
        avatar: null,
      },
      timestamp: "2024-01-01T00:00:00.000Z",
      reactions: [
        {
          count: 1,
          me: false,
          emoji: {
            id: "custom123",
            name: "custom_emoji",
          },
        },
      ],
    })

    const mockGetAllReactionFields = vi.mocked(discordApi.getAllReactionFields)
    mockGetAllReactionFields.mockResolvedValue([
      {
        emojiName: "custom_emoji",
        count: 1,
        userIds: ["user1"],
      },
    ])

    const payload = createMentionReactorsCommandPayload(messageLink)
    const request = createDiscordRequest(payload)

    const response = await POST(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect(data.type).toBe(InteractionResponseType.ChannelMessageWithSource)
    expect(data.data.embeds[0].fields[0].name).toBe("custom_emoji (1)")
    expect(data.data.embeds[0].fields[0].value).toBe("<@user1>")

    // getAllReactionFieldsが正しく呼ばれたか検証
    expect(mockGetAllReactionFields).toHaveBeenCalledWith("987654321", "111222333", [
      {
        count: 1,
        me: false,
        emoji: {
          id: "custom123",
          name: "custom_emoji",
        },
      },
    ])
  })

  it("success: メッセージが200文字より長い場合、descriptionが省略される", async () => {
    const messageLink = "https://discord.com/channels/123456789/987654321/111222333"
    const longMessage = "あ".repeat(250) // 200文字を超える長いメッセージ

    const mockGetDiscordMessage = vi.mocked(discordApi.getDiscordMessage)
    mockGetDiscordMessage.mockResolvedValue({
      id: "111222333",
      channel_id: "987654321",
      content: longMessage,
      author: {
        id: "author-id",
        username: "author",
        discriminator: "0001",
        avatar: null,
      },
      timestamp: "2024-01-01T00:00:00.000Z",
      reactions: [
        {
          count: 1,
          me: false,
          emoji: {
            id: null,
            name: "👍",
          },
        },
      ],
    })

    const mockGetAllReactionFields = vi.mocked(discordApi.getAllReactionFields)
    mockGetAllReactionFields.mockResolvedValue([
      {
        emojiName: "👍",
        count: 1,
        userIds: ["user1"],
      },
    ])

    const payload = createMentionReactorsCommandPayload(messageLink)
    const request = createDiscordRequest(payload)

    const response = await POST(request)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    const embed = data.data.embeds[0]
    expect(embed.description).toContain("...")
    expect(embed.description.length).toBeLessThanOrEqual("元メッセージ: ".length + 200 + "...".length)
  })
})
