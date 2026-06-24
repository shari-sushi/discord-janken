import { describe, it, expect, vi, beforeEach } from "vitest"
import type { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10"
import { discordLinks } from "@/app/_domains/teamSchedules/_server/schema"

// next/server: NextResponse は本物を使い、after は実行されるコールバックを捕捉して手動で走らせる
const mockAfter: { fn: (() => Promise<void>) | null } = { fn: null }
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()
  return { ...actual, after: (fn: () => Promise<void>) => { mockAfter.fn = fn } }
})

// DB は table identity で結果を出し分ける（notify.test.ts と同じ流儀）。
// findManagedTeamsByDiscordId は from(discordLinks) で始まるので discordLinks に結果を載せる。
type Row = Record<string, unknown>
const mockResults = new Map<unknown, Row[]>()
function makeQuery(result: Row[]) {
  const q: Record<string, unknown> = {
    where: () => q,
    innerJoin: () => q,
    limit: () => Promise.resolve(result),
    then: (resolve: (v: Row[]) => unknown) => resolve(result),
  }
  return q
}
vi.mock("@/app/_server/lib/db", () => ({
  db: { select: () => ({ from: (table: unknown) => makeQuery(mockResults.get(table) ?? []) }) },
}))

// 送信ヘルパーをモックし「どんな allowed_mentions で送ったか」を観測する
const mockCreateFollowupMessage = vi.fn(async (..._args: unknown[]) => undefined)
const mockEditWebhookOriginalMessage = vi.fn(async (..._args: unknown[]) => undefined)
vi.mock("@/app/_server/lib/discord/api", () => ({
  createFollowupMessage: (...args: unknown[]) => mockCreateFollowupMessage(...args),
  editWebhookOriginalMessage: (...args: unknown[]) => mockEditWebhookOriginalMessage(...args),
}))

// 招待トークン発行（Redis 書込）と magic-link（APP_URL 必須）は本パスの主眼ではないのでモック
vi.mock("@/app/_domains/teamSchedules/_server/invites", () => ({ createInviteToken: vi.fn(async () => "invtok") }))
vi.mock("@/app/_domains/teamSchedules/_server/magicLink", () => ({ createMagicLinkUrl: vi.fn(async () => "https://example/team_schedules?token=x"), MAGIC_LINK_TTL: 600 }))

import { teamScheduleInviteCommand } from "./invite"

beforeEach(() => {
  vi.clearAllMocks()
  mockResults.clear()
  mockAfter.fn = null
})

/** id だけ持つ最小の interaction を組む */
function makeInteraction(discordUserId: string): APIChatInputApplicationCommandInteraction {
  return {
    token: "interaction-token",
    application_id: "app-id",
    member: { user: { id: discordUserId, username: "管理者" } },
  } as unknown as APIChatInputApplicationCommandInteraction
}

describe("teamScheduleInviteCommand", () => {
  it("success: 募集メッセージはチーム名に @everyone が含まれてもメンション解釈を全抑止して送る", async () => {
    // 管理チームが1件・チーム名が敵対的入力（@everyone）
    mockResults.set(discordLinks, [{ userId: "u1", teamId: "t1", name: "@everyone" }])

    teamScheduleInviteCommand(makeInteraction("d1"))
    // after に逃がした実処理を走らせる
    expect(mockAfter.fn).toBeTypeOf("function")
    await mockAfter.fn!()

    // 公開の募集メッセージ（followup）と、ephemeral の確認文（webhook 編集）の両方で
    // allowed_mentions:{parse:[]} を渡していること
    expect(mockCreateFollowupMessage).toHaveBeenCalledTimes(1)
    const followupArgs = mockCreateFollowupMessage.mock.calls[0]
    expect(followupArgs[2]).toContain("@everyone") // content にチーム名がそのまま入る
    expect(followupArgs[5]).toEqual({ parse: [] }) // allowedMentions

    expect(mockEditWebhookOriginalMessage).toHaveBeenCalledTimes(1)
    const editArgs = mockEditWebhookOriginalMessage.mock.calls[0]
    // 引数: (applicationId, token, content, components, embeds, allowedMentions)
    expect(editArgs[4]).toBeUndefined() // embeds（招待確認文は content のみ）
    expect(editArgs[5]).toEqual({ parse: [] }) // allowedMentions
  })
})
