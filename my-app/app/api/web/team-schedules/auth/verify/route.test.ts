import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"
import { redisSet, redisExists } from "@/app/_server/lib/redis/redis"
import { magicLinkKey } from "@/app/_domains/teamSchedules/_server/redisKeys"

// DB: 既存リンク無し → users + discord_links を作成するパスを再現
const selectLimit = vi.fn()
const selectWhere = vi.fn(() => ({ limit: selectLimit }))
const selectFrom = vi.fn(() => ({ where: selectWhere }))
const select = vi.fn((..._a: unknown[]) => ({ from: selectFrom }))
const insertReturning = vi.fn(async () => [{ userId: "new-user-id", displayName: "テスト太郎" }])
const insertValues = vi.fn(() => ({ returning: insertReturning, then: (r: (v: undefined) => void) => r(undefined) }))
const insert = vi.fn((..._a: unknown[]) => ({ values: insertValues }))
vi.mock("@/app/_server/lib/db", () => ({
  db: {
    select: (...a: unknown[]) => select(...a),
    insert: (...a: unknown[]) => insert(...a),
  },
}))

const URL = "http://localhost:3000/api/web/team-schedules/auth/verify"

beforeEach(() => {
  vi.clearAllMocks()
  // 既存 discord_links 検索は「無し」を返す（→ セルフサインアップ経路）
  selectLimit.mockResolvedValue([])
})

describe("POST /team-schedules/auth/verify", () => {
  it("failure: tokenが無い/不正なら400", async () => {
    const res = await POST(createTestRequest(URL, { method: "POST", body: {} }))
    expect(res.status).toBe(400)
  })

  it("failure: 存在しない（期限切れ/未発行）tokenは401", async () => {
    const res = await POST(createTestRequest(URL, { method: "POST", body: { token: "nonexistent" } }))
    expect(res.status).toBe(401)
  })

  it("success: 有効なtokenでログインでき、Cookieが設定される", async () => {
    const token = "valid-token-abc"
    await redisSet(magicLinkKey(token), { discordUserId: "discord-1", username: "テスト太郎" }, 600)

    const res = await POST(createTestRequest(URL, { method: "POST", body: { token } }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.user).toEqual({ userId: "new-user-id", displayName: "テスト太郎" })
    expect(res.cookies.get("ts_session")?.value).toBeTruthy()
    // users / discord_links の2回 INSERT
    expect(insert).toHaveBeenCalledTimes(2)
  })

  it("failure: 一度使ったtokenは単回使用で消費され、2回目は401", async () => {
    const token = "single-use-token"
    await redisSet(magicLinkKey(token), { discordUserId: "discord-2", username: "二号" }, 600)

    const first = await POST(createTestRequest(URL, { method: "POST", body: { token } }))
    expect(first.status).toBe(200)

    // 検証成功時に即削除されている
    expect(await redisExists(magicLinkKey(token))).toBe(false)

    const second = await POST(createTestRequest(URL, { method: "POST", body: { token } }))
    expect(second.status).toBe(401)
  })
})
