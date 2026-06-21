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

// after() はリクエストスコープ外で呼ぶと throw するため、テストでは no-op に差し替える
// （通知発火そのものは notify.test.ts で検証する）。NextRequest/NextResponse は実物を保つ。
vi.mock("next/server", async (importActual) => {
  const actual = await importActual<typeof import("next/server")>()
  return { ...actual, after: () => {} }
})
// 通知処理は別ユニットで検証。route 単体テストでは呼ばれても何もしない
vi.mock("@/app/_domains/teamSchedules/_server/notify", () => ({
  maybeNotifyActivityReached: vi.fn(),
}))

// DB は実接続しない。書き込みが呼ばれたことだけ確認する
const onConflictDoUpdate = vi.fn(async () => undefined)
const insertValues = vi.fn(() => ({ onConflictDoUpdate }))
const insert = vi.fn((..._a: unknown[]) => ({ values: insertValues }))
const deleteWhere = vi.fn(async () => undefined)
const del = vi.fn((..._a: unknown[]) => ({ where: deleteWhere }))
// teams.managementMode を引く select チェーン（デフォルトは team モード）
const selectLimit = vi.fn(async () => [{ managementMode: "team" }])
const selectWhere = vi.fn(() => ({ limit: selectLimit }))
const selectFrom = vi.fn(() => ({ where: selectWhere }))
const select = vi.fn((..._a: unknown[]) => ({ from: selectFrom }))
vi.mock("@/app/_server/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
    insert: (...args: unknown[]) => insert(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}))

const TEAM_ID = "123e4567-e89b-42d3-a456-426614174000"
const URL = `http://localhost:3000/api/web/team-schedules/teams/${TEAM_ID}/team-status`
const ctxFor = () => ({ params: Promise.resolve({ teamId: TEAM_ID }) })

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks は実装を消さないが、Once 上書きの取り残しを避けるため毎回デフォルトを張り直す
  selectLimit.mockResolvedValue([{ managementMode: "team" }])
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

  it("failure: メンバーだがmember（admin相当未満）は400（権限不足・書き込みもしない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("member")
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

  it("failure: members モードのチームは400（チーム単位モード専用・書き込みもしない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("admin")
    selectLimit.mockResolvedValue([{ managementMode: "members" }])
    const req = createTestRequest(URL, { method: "PUT", body: { day: "2026-06-14", status: "ok", note: null } })
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

  it("success: masterならupsertされる（master ⊇ admin）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("master")
    const req = createTestRequest(URL, { method: "PUT", body: { day: "2026-06-14", status: "ok", note: null } })
    const res = await PUT(req, ctxFor())
    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalledTimes(1)
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

  it("failure: メンバーだがmember（admin相当未満）は400（削除しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockGetTeamRole.mockResolvedValue("member")
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
