import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST, DELETE } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"

// 管理API認証をモック
const mockValidateAuthHeader = vi.fn()
vi.mock("@/app/_server/lib/auth", () => ({
  validateAuthHeader: (...args: unknown[]) => mockValidateAuthHeader(...args),
}))

// DB: db.update(users).set({ suspended }).where().returning() → 更新行
const updateReturning = vi.fn(async () => [{ userId: "user-1" }])
const updateWhere = vi.fn(() => ({ returning: updateReturning }))
const updateSet = vi.fn(() => ({ where: updateWhere }))
const update = vi.fn((..._a: unknown[]) => ({ set: updateSet }))
vi.mock("@/app/_server/lib/db", () => ({
  db: { update: (...args: unknown[]) => update(...args) },
}))

const USER_ID = "123e4567-e89b-42d3-a456-426614174000"
const URL = `http://localhost:3000/api/web/team-schedules/admin/users/${USER_ID}/suspend`
const ctxFor = (userId: string = USER_ID) => ({ params: Promise.resolve({ userId }) })

beforeEach(() => {
  vi.clearAllMocks()
  mockValidateAuthHeader.mockResolvedValue({ valid: true })
  updateReturning.mockResolvedValue([{ userId: "user-1" }])
})

describe("POST /admin/users/[userId]/suspend", () => {
  it("failure: admin 認証が無ければ401（更新しない）", async () => {
    mockValidateAuthHeader.mockResolvedValue({ valid: false, error: "認証ヘッダーが必要です" })
    const res = await POST(createTestRequest(URL, { method: "POST" }), ctxFor())
    expect(res.status).toBe(401)
    expect(update).not.toHaveBeenCalled()
  })

  it("failure: 不正な userId（非UUID）は400", async () => {
    const res = await POST(createTestRequest(URL, { method: "POST" }), ctxFor("own"))
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it("failure: 対象ユーザーが存在しなければ404", async () => {
    updateReturning.mockResolvedValue([])
    const res = await POST(createTestRequest(URL, { method: "POST" }), ctxFor())
    expect(res.status).toBe(404)
  })

  it("success: suspended=true に更新する", async () => {
    const res = await POST(createTestRequest(URL, { method: "POST" }), ctxFor())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.suspended).toBe(true)
    expect(updateSet).toHaveBeenCalledWith({ suspended: true })
  })
})

describe("DELETE /admin/users/[userId]/suspend", () => {
  it("success: suspended=false に更新する（解除）", async () => {
    const res = await DELETE(createTestRequest(URL, { method: "DELETE" }), ctxFor())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.suspended).toBe(false)
    expect(updateSet).toHaveBeenCalledWith({ suspended: false })
  })
})
