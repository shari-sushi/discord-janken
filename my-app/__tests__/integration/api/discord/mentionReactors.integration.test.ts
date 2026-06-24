import { describe, it, expect, beforeEach, vi } from "vitest"
import { createMentionReactorsCommandPayload } from "../../../mocks/discord-payloads"
import { createDiscordRequest, parseJsonResponse } from "../../../helpers/api-test-utils"
import * as discordApi from "@/app/_server/lib/discord/api"
import { InteractionResponseType, MessageFlags } from "discord-api-types/v10"

// next/server: NextResponse は本物を使い、after は実行されるコールバックを捕捉して手動で走らせる
// （invite.test.ts と同じ流儀）。mentionReactors は defer + after() 型なので、
// 初回応答は DeferredChannelMessageWithSource、重い処理は after() 内で検証する。
const mockAfter: { fn: (() => Promise<void>) | null } = { fn: null }
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()
  return {
    ...actual,
    after: (fn: () => Promise<void>) => {
      mockAfter.fn = fn
    },
  }
})

// Discord API 関数をモック化（getReactionUsers 経由の取得は getAllReactionFields をモックして抽象化）
vi.mock("@/app/_server/lib/discord/api", async () => {
  const actual = await vi.importActual("@/app/_server/lib/discord/api")
  return {
    ...actual,
    getDiscordMessage: vi.fn(),
    getAllReactionFields: vi.fn(),
    editWebhookOriginalMessage: vi.fn(async () => undefined),
  }
})

// route 経由で初回応答を得て、after() コールバックを手動でフラッシュするヘルパー
async function dispatchAndFlush(messageLink: string) {
  const { POST } = await import("@/app/api/discord/route")
  const payload = createMentionReactorsCommandPayload(messageLink)
  const request = createDiscordRequest(payload)

  const response = await POST(request)
  const data = await parseJsonResponse(response)

  // after() 内の重い処理を実行
  if (mockAfter.fn) {
    await mockAfter.fn()
  }

  return { response, data }
}

describe("Discord API - /user-mention-reactors Command Integration Test", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAfter.fn = null
  })

  it("success: 正常系は初回応答が deferred で返り、after() で embed を editWebhookOriginalMessage に渡す", async () => {
    const messageLink = "https://discord.com/channels/123456789/987654321/111222333"

    vi.mocked(discordApi.getDiscordMessage).mockResolvedValue({
      id: "111222333",
      channel_id: "987654321",
      content: "これはテストメッセージです",
      reactions: [{ count: 2, me: false, emoji: { id: null, name: "👍" } }],
    } as Awaited<ReturnType<typeof discordApi.getDiscordMessage>>)

    vi.mocked(discordApi.getAllReactionFields).mockResolvedValue([{ emojiName: "👍", count: 2, userIds: ["user1", "user2"] }])

    const { response, data } = await dispatchAndFlush(messageLink)

    // 初回応答は deferred（3秒制限回避）
    expect(response.status).toBe(200)
    expect(data.type).toBe(InteractionResponseType.DeferredChannelMessageWithSource)

    // after() で取得関数が呼ばれている
    expect(discordApi.getDiscordMessage).toHaveBeenCalledWith("987654321", "111222333")
    expect(discordApi.getAllReactionFields).toHaveBeenCalledWith("987654321", "111222333", [{ count: 2, me: false, emoji: { id: null, name: "👍" } }])

    // 結果は embed で editWebhookOriginalMessage に差し替えられる。content は空・allowed_mentions は全抑止
    expect(discordApi.editWebhookOriginalMessage).toHaveBeenCalledTimes(1)
    const editCall = vi.mocked(discordApi.editWebhookOriginalMessage).mock.calls[0]
    // 引数: (applicationId, token, content, components, embeds, allowedMentions)
    expect(editCall[2]).toBe("")
    expect(editCall[4]).toHaveLength(1)
    const embed = editCall[4]?.[0]
    expect(embed?.title).toBe("リアクションメンバー")
    expect(embed?.description).toContain("これはテストメッセージです")
    expect(embed?.fields?.[0].name).toBe("👍 (2)")
    expect(embed?.fields?.[0].value).toBe("<@user1> <@user2>")
    expect(editCall[5]).toEqual({ parse: [] })
  })

  it("failure: 不正なメッセージリンクは defer せず ephemeral で即返す", async () => {
    const { response, data } = await dispatchAndFlush("https://example.com/invalid/link")

    expect(response.status).toBe(200)
    expect(data.type).toBe(InteractionResponseType.ChannelMessageWithSource)
    expect(data.data.content).toContain("不正なメッセージリンクです")
    expect(data.data.flags).toBe(MessageFlags.Ephemeral)
    // 入力エラーなので after() は登録されない
    expect(mockAfter.fn).toBeNull()
  })

  it("failure: リアクションがない場合は after() 内で editWebhookOriginalMessage に文言を差し替える", async () => {
    const messageLink = "https://discord.com/channels/123456789/987654321/111222333"

    vi.mocked(discordApi.getDiscordMessage).mockResolvedValue({
      id: "111222333",
      channel_id: "987654321",
      content: "リアクションなしのメッセージ",
      reactions: [],
    } as Awaited<ReturnType<typeof discordApi.getDiscordMessage>>)

    const { data } = await dispatchAndFlush(messageLink)

    expect(data.type).toBe(InteractionResponseType.DeferredChannelMessageWithSource)
    expect(discordApi.editWebhookOriginalMessage).toHaveBeenCalledTimes(1)
    expect(vi.mocked(discordApi.editWebhookOriginalMessage).mock.calls[0][2]).toContain("リアクションがありません")
    // embed は渡さない（content のみの差し替え）
    expect(vi.mocked(discordApi.editWebhookOriginalMessage).mock.calls[0][4]).toBeUndefined()
  })

  it("failure: 取得失敗時は after() 内でエラー文言を editWebhookOriginalMessage に差し替える", async () => {
    const messageLink = "https://discord.com/channels/123456789/987654321/999999999"

    vi.mocked(discordApi.getDiscordMessage).mockRejectedValue(new Error("Message not found"))

    const { data } = await dispatchAndFlush(messageLink)

    expect(data.type).toBe(InteractionResponseType.DeferredChannelMessageWithSource)
    expect(discordApi.editWebhookOriginalMessage).toHaveBeenCalledTimes(1)
    expect(vi.mocked(discordApi.editWebhookOriginalMessage).mock.calls[0][2]).toContain("取得に失敗しました")
  })

  it("failure: 429（レートリミット）時は専用のエラー文言を差し替える", async () => {
    const messageLink = "https://discord.com/channels/123456789/987654321/111222333"

    vi.mocked(discordApi.getDiscordMessage).mockResolvedValue({
      id: "111222333",
      channel_id: "987654321",
      content: "テスト",
      reactions: [{ count: 1, me: false, emoji: { id: null, name: "👍" } }],
    } as Awaited<ReturnType<typeof discordApi.getDiscordMessage>>)

    vi.mocked(discordApi.getAllReactionFields).mockRejectedValue(new discordApi.DiscordApiError(429, "Too Many Requests", { retry_after: 1 }))

    const { data } = await dispatchAndFlush(messageLink)

    expect(data.type).toBe(InteractionResponseType.DeferredChannelMessageWithSource)
    expect(vi.mocked(discordApi.editWebhookOriginalMessage).mock.calls[0][2]).toContain("レートリミット")
  })
})
