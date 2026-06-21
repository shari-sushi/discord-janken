import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, POST } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"

// 管理API認証をモック（admin 認証の成否で 401/処理続行を切り替える）
const mockValidateAuthHeader = vi.fn()
vi.mock("@/app/_server/lib/auth", () => ({
  validateAuthHeader: (...args: unknown[]) => mockValidateAuthHeader(...args),
}))

// bans ドメインロジックはモック（DB を引かない）
const mockListDiscordBans = vi.fn()
const mockAddDiscordBan = vi.fn()
vi.mock("@/app/_domains/teamSchedules/_server/bans", () => ({
  listDiscordBans: (...args: unknown[]) => mockListDiscordBans(...args),
  addDiscordBan: (...args: unknown[]) => mockAddDiscordBan(...args),
}))

const URL = "http://localhost:3000/api/web/team-schedules/admin/discord-bans"
const BANNED_AT = new Date("2026-06-20T00:00:00.000Z")

beforeEach(() => {
  vi.clearAllMocks()
  mockValidateAuthHeader.mockResolvedValue({ valid: true })
  mockListDiscordBans.mockResolvedValue([{ discordUserId: "123456789012345678", reason: "spam", bannedAt: BANNED_AT }])
  mockAddDiscordBan.mockResolvedValue({ discordUserId: "123456789012345678", reason: "spam", bannedAt: BANNED_AT })
})

describe("GET /team-schedules/admin/discord-bans", () => {
  it("failure: admin 認証が無ければ401（権限分離・一覧を引かない）", async () => {
    mockValidateAuthHeader.mockResolvedValue({ valid: false, error: "認証ヘッダーが必要です" })
    const res = await GET(createTestRequest(URL))
    expect(res.status).toBe(401)
    expect(mockListDiscordBans).not.toHaveBeenCalled()
  })

  it("success: admin なら BAN 一覧を ISO 文字列で返す", async () => {
    const res = await GET(createTestRequest(URL, { headers: { authorization: "Bearer x" } }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.bans).toEqual([{ discordUserId: "123456789012345678", reason: "spam", bannedAt: BANNED_AT.toISOString() }])
  })
})

describe("POST /team-schedules/admin/discord-bans", () => {
  it("failure: admin 認証が無ければ401（追加しない）", async () => {
    mockValidateAuthHeader.mockResolvedValue({ valid: false, error: "認証ヘッダーが必要です" })
    const res = await POST(createTestRequest(URL, { method: "POST", body: { discordUserId: "123456789012345678" } }))
    expect(res.status).toBe(401)
    expect(mockAddDiscordBan).not.toHaveBeenCalled()
  })

  it("failure: 不正な Discord ID（数字以外）は400（追加しない）", async () => {
    const res = await POST(createTestRequest(URL, { method: "POST", body: { discordUserId: "not-a-snowflake" } }))
    expect(res.status).toBe(400)
    expect(mockAddDiscordBan).not.toHaveBeenCalled()
  })

  it("success: admin なら BAN を追加し、理由は trim される", async () => {
    const res = await POST(createTestRequest(URL, { method: "POST", body: { discordUserId: "123456789012345678", reason: "  spam  " } }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(mockAddDiscordBan).toHaveBeenCalledWith("123456789012345678", "spam")
    expect(json.ban).toEqual({ discordUserId: "123456789012345678", reason: "spam", bannedAt: BANNED_AT.toISOString() })
  })

  it("success: 理由が空文字なら null として追加する", async () => {
    await POST(createTestRequest(URL, { method: "POST", body: { discordUserId: "123456789012345678", reason: "   " } }))
    expect(mockAddDiscordBan).toHaveBeenCalledWith("123456789012345678", null)
  })
})
