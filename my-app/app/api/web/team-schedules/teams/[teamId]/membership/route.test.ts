import { describe, it, expect, vi, beforeEach } from "vitest"
import { DELETE } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"

// 認可ヘルパーをモック（ログイン状態・ロール判定を route 単体で検証する）
const mockGetSessionUserId = vi.fn()
const mockGetTeamRole = vi.fn()
vi.mock("@/app/_domains/teamSchedules/_server/authz", () => ({
  getSessionUserId: (...args: unknown[]) => mockGetSessionUserId(...args),
  getTeamRole: (...args: unknown[]) => mockGetTeamRole(...args),
}))

// db.delete().where() を await する形をモック
const deleteWhere = vi.fn(async () => undefined)
const dbDelete = vi.fn((..._a: unknown[]) => ({ where: deleteWhere }))
vi.mock("@/app/_server/lib/db", () => ({
  db: { delete: (...args: unknown[]) => dbDelete(...args) },
}))

const TEAM_ID = "123e4567-e89b-42d3-a456-426614174000"
const URL = `http://localhost:3000/api/web/team-schedules/teams/${TEAM_ID}/membership`
const ctx = (teamId: string) => ({ params: Promise.resolve({ teamId }) })

beforeEach(() => {
  vi.clearAllMocks()
})

describe("DELETE /team-schedules/teams/[teamId]/membership", () => {
  it("failure: 非UUIDなら404（削除しない）", async () => {
    const res = await DELETE(createTestRequest(URL, { method: "DELETE" }), ctx("not-a-uuid"))
    expect(res.status).toBe(404)
    expect(dbDelete).not.toHaveBeenCalled()
  })

  it("failure: 未ログインなら401（削除しない）", async () => {
    mockGetSessionUserId.mockResolvedValue(null)
    const res = await DELETE(createTestRequest(URL, { method: "DELETE" }), ctx(TEAM_ID))
    expect(res.status).toBe(401)
    expect(dbDelete).not.toHaveBeenCalled()
  })

  it("failure: 非メンバー（role=null）なら404（削除しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue(null)
    const res = await DELETE(createTestRequest(URL, { method: "DELETE" }), ctx(TEAM_ID))
    expect(res.status).toBe(404)
    expect(dbDelete).not.toHaveBeenCalled()
  })

  it("failure: master は脱退できず403（削除しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("master")
    const res = await DELETE(createTestRequest(URL, { method: "DELETE" }), ctx(TEAM_ID))
    expect(res.status).toBe(403)
    expect(dbDelete).not.toHaveBeenCalled()
  })

  it("success: member は脱退でき200（自分の行を削除）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("member")
    const res = await DELETE(createTestRequest(URL, { method: "DELETE" }), ctx(TEAM_ID))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(dbDelete).toHaveBeenCalledTimes(1)
    expect(deleteWhere).toHaveBeenCalledTimes(1)
  })
})
