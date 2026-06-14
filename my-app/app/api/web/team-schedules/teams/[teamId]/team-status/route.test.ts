import { describe, it, expect, vi, beforeEach } from "vitest"
import { PUT, DELETE } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"

// 認可ヘルパーをモック（非メンバー404・非admin400・admin200 のロジックを route 単体で検証する）
const mockGetSessionUserId = vi.fn()
const mockGetTeamRole = vi.fn()
vi.mock("@/app/_domains/teamSchedules/_server/authz", () => ({
  getSessionUserId: (...args: unknown[]) => mockGetSessionUserId(...args),
  getTeamRole: (...args: unknown[]) => mockGetTeamRole(...args),
}))

// DB は実接続しない。書き込みが呼ばれたことだけ確認する
const onConflictDoUpdate = vi.fn(async () => undefined)
const insertValues = vi.fn(() => ({ onConflictDoUpdate }))
const insert = vi.fn((..._a: unknown[]) => ({ values: insertValues }))
const deleteWhere = vi.fn(async () => undefined)
const del = vi.fn((..._a: unknown[]) => ({ where: deleteWhere }))
vi.mock("@/app/_server/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => insert(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}))

const TEAM_ID = "123e4567-e89b-42d3-a456-426614174000"
const URL = `http://localhost:3000/api/web/team-schedules/teams/${TEAM_ID}/team-status`
const ctxFor = () => ({ params: Promise.resolve({ teamId: TEAM_ID }) })

beforeEach(() => {
  vi.clearAllMocks()
})

describe("PUT /team-schedules/teams/[teamId]/team-status", () => {
  it("failure: 未ログインなら401（DB書き込みは発生しない）", async () => {
    mockGetSessionUserId.mockResolvedValue(null)
    const req = createTestRequest(URL, { method: "PUT", body: { day: "2026-06-14", status: "ok", note: null } })
    const res = await PUT(req, ctxFor())
    expect(res.status).toBe(401)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: 非メンバーは404（存在を隠す・書き込みもしない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue(null)
    const req = createTestRequest(URL, { method: "PUT", body: { day: "2026-06-14", status: "ok", note: null } })
    const res = await PUT(req, ctxFor())
    expect(res.status).toBe(404)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: メンバーだが非adminは400（権限不足・書き込みもしない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("individual")
    const req = createTestRequest(URL, { method: "PUT", body: { day: "2026-06-14", status: "ok", note: null } })
    const res = await PUT(req, ctxFor())
    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: 不正なstatusは400", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("admin")
    const req = createTestRequest(URL, { method: "PUT", body: { day: "2026-06-14", status: "perhaps", note: null } })
    const res = await PUT(req, ctxFor())
    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: 不正なteamId（非UUID）は404", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    const badCtx = { params: Promise.resolve({ teamId: "own" }) }
    const req = createTestRequest(URL, { method: "PUT", body: { day: "2026-06-14", status: "ok", note: null } })
    const res = await PUT(req, badCtx)
    expect(res.status).toBe(404)
  })

  it("success: adminならupsertされる", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("admin")
    const req = createTestRequest(URL, { method: "PUT", body: { day: "2026-06-14", status: "ok", note: "21:00~" } })
    const res = await PUT(req, ctxFor())
    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ teamId: TEAM_ID, day: "2026-06-14", status: "ok", note: "21:00~" }))
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1)
  })
})

describe("DELETE /team-schedules/teams/[teamId]/team-status", () => {
  it("failure: 未ログインなら401（削除しない）", async () => {
    mockGetSessionUserId.mockResolvedValue(null)
    const req = createTestRequest(URL, { method: "DELETE", body: { day: "2026-06-14" } })
    const res = await DELETE(req, ctxFor())
    expect(res.status).toBe(401)
    expect(del).not.toHaveBeenCalled()
  })

  it("failure: 非メンバーは404（削除しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue(null)
    const req = createTestRequest(URL, { method: "DELETE", body: { day: "2026-06-14" } })
    const res = await DELETE(req, ctxFor())
    expect(res.status).toBe(404)
    expect(del).not.toHaveBeenCalled()
  })

  it("failure: メンバーだが非adminは400（削除しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("individual")
    const req = createTestRequest(URL, { method: "DELETE", body: { day: "2026-06-14" } })
    const res = await DELETE(req, ctxFor())
    expect(res.status).toBe(400)
    expect(del).not.toHaveBeenCalled()
  })

  it("success: adminなら行が削除される", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("admin")
    const req = createTestRequest(URL, { method: "DELETE", body: { day: "2026-06-14" } })
    const res = await DELETE(req, ctxFor())
    expect(res.status).toBe(200)
    expect(del).toHaveBeenCalledTimes(1)
    expect(deleteWhere).toHaveBeenCalledTimes(1)
  })
})
