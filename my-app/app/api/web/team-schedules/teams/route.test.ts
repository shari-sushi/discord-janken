import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, POST } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"

import { teams as teamsTable, teamMembers as teamMembersTable } from "@/app/_domains/teamSchedules/_server/schema"

// 認可ヘルパーをモック（未ログイン401・権限なし403・作成成功 のロジックを route 単体で検証する）
const mockGetSessionUserId = vi.fn()
const mockCanCreateTeam = vi.fn()
const mockIsUserSuspended = vi.fn()
vi.mock("@/app/_domains/teamSchedules/_server/authz", () => ({
  getSessionUserId: (...args: unknown[]) => mockGetSessionUserId(...args),
  canCreateTeam: (...args: unknown[]) => mockCanCreateTeam(...args),
  isUserSuspended: (...args: unknown[]) => mockIsUserSuspended(...args),
}))

// 共有相手の引き当てはモック（#175・GET の可視チーム集合の組み立てを route 単体で検証する）
const mockGetSharePartnersForTeams = vi.fn()
vi.mock("@/app/_domains/teamSchedules/_server/shares", () => ({
  getSharePartnersForTeams: (...args: unknown[]) => mockGetSharePartnersForTeams(...args),
}))

// DB は実接続しない。
// - POST: db.insert(teams).values().returning() → [team]、続けて db.insert(teamMembers).values() を await
// - GET : db.select().from(table).where() → table の identity で行を出し分ける（thenable チェーン）
const TEAM = { teamId: "123e4567-e89b-42d3-a456-426614174000", name: "Aチーム", description: null, requiredCount: 5, managementMode: "members" }
const PARTNER = { teamId: "223e4567-e89b-42d3-a456-426614174111", name: "Bチーム", description: null, requiredCount: 5, managementMode: "members" }
const insertReturning = vi.fn(async () => [TEAM])
const insertValues = vi.fn(() => ({ returning: insertReturning, then: (r: (v: undefined) => void) => r(undefined) }))
const insert = vi.fn((..._a: unknown[]) => ({ values: insertValues }))
// table identity → 返す行。GET 内の teamMembers / teams の SELECT を出し分ける
const selectResults = new Map<unknown, unknown[]>()
function makeSelectQuery(rows: unknown[]) {
  const q: Record<string, unknown> = {
    where: () => q,
    then: (resolve: (v: unknown[]) => unknown) => resolve(rows),
  }
  return q
}
const select = vi.fn((..._a: unknown[]) => ({ from: (table: unknown) => makeSelectQuery(selectResults.get(table) ?? []) }))
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
  selectResults.clear()
  mockGetSharePartnersForTeams.mockResolvedValue(new Map())
  // デフォルトは利用停止でない（個別テストで上書き）
  mockIsUserSuspended.mockResolvedValue(false)
})

describe("GET /team-schedules/teams", () => {
  it("success: 未ログインは空配列を返す（public read 廃止・#175）", async () => {
    mockGetSessionUserId.mockResolvedValue(null)
    const res = await GET(createTestRequest(URL))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.teams).toEqual([])
    // 未ログインなら所属・共有の照会は一切走らない
    expect(mockGetSharePartnersForTeams).not.toHaveBeenCalled()
  })

  it("success: ログイン中は 所属 ∪ 共有相手 のみ返し、所属チームに sharedTeamIds を付与する（#175）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    // user-1 は TEAM の master として所属
    selectResults.set(teamMembersTable, [{ teamId: TEAM.teamId, teamRole: "master" }])
    // TEAM は PARTNER と共有している
    mockGetSharePartnersForTeams.mockResolvedValue(new Map([[TEAM.teamId, [PARTNER.teamId]]]))
    // 可視チーム（所属 ∪ 共有相手）= TEAM, PARTNER
    selectResults.set(teamsTable, [TEAM, PARTNER])

    const res = await GET(createTestRequest(URL))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.teams).toEqual([
      { ...TEAM, isMember: true, isMaster: true, sharedTeamIds: [PARTNER.teamId] },
      // 共有相手として可視なだけのチームは非所属・sharedTeamIds は空
      { ...PARTNER, isMember: false, isMaster: false, sharedTeamIds: [] },
    ])
  })

  it("success: どのチームにも所属せず共有も無ければ空配列（可視チーム0件）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    selectResults.set(teamMembersTable, [])
    mockGetSharePartnersForTeams.mockResolvedValue(new Map())
    const res = await GET(createTestRequest(URL))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.teams).toEqual([])
  })
})

describe("POST /team-schedules/teams", () => {
  it("failure: 未ログインなら401（作成しない）", async () => {
    mockGetSessionUserId.mockResolvedValue(null)
    const res = await POST(createTestRequest(URL, { method: "POST", body: validBody }))
    expect(res.status).toBe(401)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: 参加上限に達していれば403（作成しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockCanCreateTeam.mockResolvedValue(false)
    const res = await POST(createTestRequest(URL, { method: "POST", body: validBody }))
    expect(res.status).toBe(403)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: 利用停止中ユーザーは403（作成しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockIsUserSuspended.mockResolvedValue(true)
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
