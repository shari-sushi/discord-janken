import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolveOrCreateUserByDiscordId } from "./userResolver"

// db を最小モック（select→where→limit / insert→values→returning のチェーン）
const selectLimit = vi.fn()
const selectWhere = vi.fn(() => ({ limit: selectLimit }))
const selectFrom = vi.fn(() => ({ where: selectWhere }))
const select = vi.fn((..._a: unknown[]) => ({ from: selectFrom }))
const insertReturning = vi.fn(async () => [{ userId: "new-user-id", displayName: "新規太郎" }])
const insertValues = vi.fn(() => ({ returning: insertReturning, then: (r: (v: undefined) => void) => r(undefined) }))
const insert = vi.fn((..._a: unknown[]) => ({ values: insertValues }))
vi.mock("@/app/_server/lib/db", () => ({
  db: {
    select: (...a: unknown[]) => select(...a),
    insert: (...a: unknown[]) => insert(...a),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("resolveOrCreateUserByDiscordId", () => {
  it("success: 既存リンクがあれば作成せず既存ユーザーを返す", async () => {
    // 1回目: discord_links 検索ヒット / 2回目: users の displayName 取得
    selectLimit.mockResolvedValueOnce([{ userId: "existing-id" }]).mockResolvedValueOnce([{ displayName: "既存花子" }])

    const result = await resolveOrCreateUserByDiscordId("discord-1", "fallback名")

    expect(result).toEqual({ userId: "existing-id", displayName: "既存花子" })
    expect(insert).not.toHaveBeenCalled()
  })

  it("success: リンクが無ければ users + discord_links を作成する", async () => {
    // discord_links 検索は空 → セルフサインアップ経路
    selectLimit.mockResolvedValue([])

    const result = await resolveOrCreateUserByDiscordId("discord-2", "新規太郎")

    expect(result).toEqual({ userId: "new-user-id", displayName: "新規太郎" })
    // users / discord_links の2回 INSERT
    expect(insert).toHaveBeenCalledTimes(2)
  })
})
