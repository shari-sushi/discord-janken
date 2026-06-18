import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, POST } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"

// 認可ヘルパーをモック（未ログイン401・権限なし403・作成成功 のロジックを route 単体で検証する）
const mockGetSessionUserId = vi.fn()
const mockCanCreateTeam = vi.fn()
vi.mock("@/app/_domains/teamSchedules/_server/authz", () => ({
  getSessionUserId: (...args: unknown[]) => mockGetSessionUserId(...args),
  canCreateTeam: (...args: unknown[]) => mockCanCreateTeam(...args),
}))

// DB は実接続しない。
// - POST: db.insert(teams).values().returning() → [team]、続けて db.insert(teamMembers).values() を await
// - GET : db.select().from() → 行配列
const TEAM = { teamId: "123e4567-e89b-42d3-a456-426614174000", name: "Aチーム", description: null, requiredCount: 5, managementMode: "members" }
const insertReturning = vi.fn(async () => [TEAM])
const insertValues = vi.fn(() => ({ returning: insertReturning, then: (r: (v: undefined) => void) => r(undefined) }))
const insert = vi.fn((..._a: unknown[]) => ({ values: insertValues }))
const selectFrom = vi.fn(async () => [] as unknown[])
const select = vi.fn((..._a: unknown[]) => ({ from: selectFrom }))
vi.mock("@/app/_server/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
    insert: (...args: unknown[]) => insert(...args),
  },
}))

const URL = "http://localhost:3000/api/web/team-schedules/teams"
const validBody = { name: "Aチーム", description: null, managementMode: "members", requiredCount: 5 }

beforeEach(() => {
  vi.clearAllMocks()
  insertReturning.mockResolvedValue([TEAM])
  selectFrom.mockResolvedValue([])
})

describe("GET /team-schedules/teams", () => {
  it("success: チーム一覧を返す（未ログインは isMember:false）", async () => {
    // 未ログイン（getSessionUserId 未モック→undefined）なので所属チーム照会は走らず全て isMember:false
    mockGetSessionUserId.mockResolvedValue(null)
    selectFrom.mockResolvedValue([TEAM])
    const res = await GET(createTestRequest(URL))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.teams).toEqual([{ ...TEAM, isMember: false, isMaster: false }])
  })
})

describe("POST /team-schedules/teams", () => {
  it("failure: 未ログインなら401（作成しない）", async () => {
    mockGetSessionUserId.mockResolvedValue(null)
    const res = await POST(createTestRequest(URL, { method: "POST", body: validBody }))
    expect(res.status).toBe(401)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: 作成権限が無ければ403（作成しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockCanCreateTeam.mockResolvedValue(false)
    const res = await POST(createTestRequest(URL, { method: "POST", body: validBody }))
    expect(res.status).toBe(403)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: チーム名が空白のみなら400（作成しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockCanCreateTeam.mockResolvedValue(true)
    const res = await POST(createTestRequest(URL, { method: "POST", body: { ...validBody, name: "   " } }))
    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: 不正な managementMode は400（作成しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockCanCreateTeam.mockResolvedValue(true)
    const res = await POST(createTestRequest(URL, { method: "POST", body: { ...validBody, managementMode: "solo" } }))
    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it("success: チームを作成し、作成者を master で登録する（teams+team_members の2回INSERT）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockCanCreateTeam.mockResolvedValue(true)
    const res = await POST(createTestRequest(URL, { method: "POST", body: validBody }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.team).toEqual(TEAM)
    // teams INSERT → team_members INSERT の2回
    expect(insert).toHaveBeenCalledTimes(2)
    // 作成者が master として登録される
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ teamId: TEAM.teamId, userId: "user-1", teamRole: "master" }))
  })
})
