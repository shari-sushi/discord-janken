import { describe, it, expect, vi, beforeEach } from "vitest"
import { PATCH } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"

// 認可ヘルパーをモック（非メンバー404・非admin400・admin200 のロジックを route 単体で検証する）
const mockGetSessionUserId = vi.fn()
const mockGetTeamRole = vi.fn()
vi.mock("@/app/_domains/teamSchedules/_server/authz", () => ({
  getSessionUserId: (...args: unknown[]) => mockGetSessionUserId(...args),
  getTeamRole: (...args: unknown[]) => mockGetTeamRole(...args),
}))

// DB は実接続しない。update が呼ばれたかと、返却用の re-select だけ確認する
const updateWhere = vi.fn(async () => undefined)
const updateSet = vi.fn(() => ({ where: updateWhere }))
const update = vi.fn((..._a: unknown[]) => ({ set: updateSet }))
// 返却用 select チェーン（更新後のチーム1行）
const TEAM_ROW = { teamId: "", name: "テストチーム", description: null, requiredCount: 3, managementMode: "team" }
const selectLimit = vi.fn(async () => [TEAM_ROW])
const selectWhere = vi.fn(() => ({ limit: selectLimit }))
const selectFrom = vi.fn(() => ({ where: selectWhere }))
const select = vi.fn((..._a: unknown[]) => ({ from: selectFrom }))
vi.mock("@/app/_server/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
    update: (...args: unknown[]) => update(...args),
  },
}))

const TEAM_ID = "123e4567-e89b-42d3-a456-426614174000"
const URL = `http://localhost:3000/api/web/team-schedules/teams/${TEAM_ID}`
const ctxFor = () => ({ params: Promise.resolve({ teamId: TEAM_ID }) })

beforeEach(() => {
  vi.clearAllMocks()
  selectLimit.mockResolvedValue([{ ...TEAM_ROW, teamId: TEAM_ID }])
})

describe("PATCH /team-schedules/teams/[teamId]", () => {
  it("failure: 未ログインなら401（DB更新は発生しない）", async () => {
    mockGetSessionUserId.mockResolvedValue(null)
    const req = createTestRequest(URL, { method: "PATCH", body: { managementMode: "team" } })
    const res = await PATCH(req, ctxFor())
    expect(res.status).toBe(401)
    expect(update).not.toHaveBeenCalled()
  })

  it("failure: 非メンバーは404（存在を隠す・更新もしない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue(null)
    const req = createTestRequest(URL, { method: "PATCH", body: { managementMode: "team" } })
    const res = await PATCH(req, ctxFor())
    expect(res.status).toBe(404)
    expect(update).not.toHaveBeenCalled()
  })

  it("failure: メンバーだがmember（admin相当未満）は400（権限不足・更新もしない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("member")
    const req = createTestRequest(URL, { method: "PATCH", body: { managementMode: "team" } })
    const res = await PATCH(req, ctxFor())
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it("failure: 不正なteamId（非UUID）は404", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    const badCtx = { params: Promise.resolve({ teamId: "own" }) }
    const req = createTestRequest(URL, { method: "PATCH", body: { managementMode: "team" } })
    const res = await PATCH(req, badCtx)
    expect(res.status).toBe(404)
    expect(update).not.toHaveBeenCalled()
  })

  it("failure: 不正な managementMode は400（更新もしない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("admin")
    const req = createTestRequest(URL, { method: "PATCH", body: { managementMode: "solo" } })
    const res = await PATCH(req, ctxFor())
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it("success: adminが managementMode を変更すると update され、更新後のチームを返す", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("admin")
    const req = createTestRequest(URL, { method: "PATCH", body: { managementMode: "team" } })
    const res = await PATCH(req, ctxFor())
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledTimes(1)
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ managementMode: "team" }))
    const json = await res.json()
    expect(json).toMatchObject({ success: true, team: { teamId: TEAM_ID, managementMode: "team" } })
  })

  it("success: masterも変更できる（master ⊇ admin）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("master")
    const req = createTestRequest(URL, { method: "PATCH", body: { managementMode: "members" } })
    const res = await PATCH(req, ctxFor())
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it("success: managementMode 無し（空ボディ）は no-op で現在のチームを200で返す", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("admin")
    const req = createTestRequest(URL, { method: "PATCH", body: {} })
    const res = await PATCH(req, ctxFor())
    expect(res.status).toBe(200)
    // 適用対象が無いので DB 更新は走らない（冪等な no-op）
    expect(update).not.toHaveBeenCalled()
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it("success: 無視するフィールド（name 等）のみのボディも no-op で200（第1弾は managementMode 以外無視）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("admin")
    const req = createTestRequest(URL, { method: "PATCH", body: { name: "新しい名前" } })
    const res = await PATCH(req, ctxFor())
    expect(res.status).toBe(200)
    expect(update).not.toHaveBeenCalled()
  })
})
