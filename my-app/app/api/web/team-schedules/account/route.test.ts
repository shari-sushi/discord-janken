import { describe, it, expect, vi, beforeEach } from "vitest"
import { DELETE } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"

// 認可ヘルパー（ログイン状態）をモック
const mockGetSessionUserId = vi.fn()
vi.mock("@/app/_domains/teamSchedules/_server/authz", () => ({
  getSessionUserId: (...args: unknown[]) => mockGetSessionUserId(...args),
}))

// db.delete().where() を await する形をモック
const deleteWhere = vi.fn(async () => undefined)
const dbDelete = vi.fn((..._a: unknown[]) => ({ where: deleteWhere }))
// db.select().from().where().limit() で master 在籍チェック。既定は「master なし」（[]）
const selectLimit = vi.fn(async () => [] as unknown[])
const selectWhere = vi.fn(() => ({ limit: selectLimit }))
const selectFrom = vi.fn(() => ({ where: selectWhere }))
const dbSelect = vi.fn((..._a: unknown[]) => ({ from: selectFrom }))
vi.mock("@/app/_server/lib/db", () => ({
  db: { select: (...args: unknown[]) => dbSelect(...args), delete: (...args: unknown[]) => dbDelete(...args) },
}))

// セッション破棄系をモック（Cookie 名・破棄関数・Cookie オプション）
const mockDeleteUserSession = vi.fn(async (..._a: unknown[]) => true)
vi.mock("@/app/_domains/teamSchedules/_server/session", () => ({
  TS_SESSION_COOKIE: "ts_session",
  deleteUserSession: (...args: unknown[]) => mockDeleteUserSession(...args),
  sessionCookieOptions: () => ({ httpOnly: true, secure: false, sameSite: "lax" as const, path: "/", maxAge: 60 }),
}))

const URL = "http://localhost:3000/api/web/team-schedules/account"

beforeEach(() => {
  vi.clearAllMocks()
  selectLimit.mockResolvedValue([])
})

describe("DELETE /team-schedules/account", () => {
  it("failure: 未ログインなら401（削除しない）", async () => {
    mockGetSessionUserId.mockResolvedValue(null)
    const res = await DELETE(createTestRequest(URL, { method: "DELETE" }))
    expect(res.status).toBe(401)
    expect(dbDelete).not.toHaveBeenCalled()
  })

  it("failure: master のチームがあれば403（削除しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    selectLimit.mockResolvedValue([{ teamId: "t1" }])
    const res = await DELETE(createTestRequest(URL, { method: "DELETE" }))
    expect(res.status).toBe(403)
    expect(dbDelete).not.toHaveBeenCalled()
  })

  it("success: ログイン中ユーザーの users 行を削除し200（Cookieを失効）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    const res = await DELETE(createTestRequest(URL, { method: "DELETE" }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(dbDelete).toHaveBeenCalledTimes(1)
    expect(deleteWhere).toHaveBeenCalledTimes(1)
    // Cookie を maxAge:0 で失効させている
    expect(res.cookies.get("ts_session")?.value).toBe("")
  })
})
