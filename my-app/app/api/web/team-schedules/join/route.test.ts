import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"
import { redisSet } from "@/app/_server/lib/redis/redis"
import { inviteKey } from "@/app/_domains/teamSchedules/_server/redisKeys"

// 認可ヘルパーをモック
const mockGetSessionUserId = vi.fn()
vi.mock("@/app/_domains/teamSchedules/_server/authz", () => ({
  getSessionUserId: (...args: unknown[]) => mockGetSessionUserId(...args),
}))

// DB は実接続しない。
// - db.select().from().where().limit() → [team] / []
// - db.insert(teamMembers).values().onConflictDoNothing() を await（冪等参加）
const TEAM = { teamId: "123e4567-e89b-42d3-a456-426614174000", name: "Aチーム", description: null, requiredCount: 5, managementMode: "members" }
const selectLimit = vi.fn(async () => [TEAM])
const selectWhere = vi.fn(() => ({ limit: selectLimit }))
const selectFrom = vi.fn(() => ({ where: selectWhere }))
const select = vi.fn((..._a: unknown[]) => ({ from: selectFrom }))
const onConflictDoNothing = vi.fn(async () => undefined)
const insertValues = vi.fn(() => ({ onConflictDoNothing }))
const insert = vi.fn((..._a: unknown[]) => ({ values: insertValues }))
vi.mock("@/app/_server/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
    insert: (...args: unknown[]) => insert(...args),
  },
}))

const URL = "http://localhost:3000/api/web/team-schedules/join"
const TOKEN = "invite-token-abc"

beforeEach(() => {
  vi.clearAllMocks()
  selectLimit.mockResolvedValue([TEAM])
})

describe("POST /team-schedules/join", () => {
  it("failure: 未ログインなら401（参加しない）", async () => {
    mockGetSessionUserId.mockResolvedValue(null)
    await redisSet(inviteKey(TOKEN), { teamId: TEAM.teamId }, 600)
    const res = await POST(createTestRequest(URL, { method: "POST", body: { token: TOKEN } }))
    expect(res.status).toBe(401)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: tokenが無ければ400", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    const res = await POST(createTestRequest(URL, { method: "POST", body: {} }))
    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: 失効/無効な招待トークンは401", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    const res = await POST(createTestRequest(URL, { method: "POST", body: { token: "nonexistent" } }))
    expect(res.status).toBe(401)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: 招待は有効だが参加先チームが消えていれば404", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    await redisSet(inviteKey(TOKEN), { teamId: TEAM.teamId }, 600)
    selectLimit.mockResolvedValue([])
    const res = await POST(createTestRequest(URL, { method: "POST", body: { token: TOKEN } }))
    expect(res.status).toBe(404)
    expect(insert).not.toHaveBeenCalled()
  })

  it("success: 招待トークンで individual として参加する（冪等INSERT）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    await redisSet(inviteKey(TOKEN), { teamId: TEAM.teamId }, 600)
    const res = await POST(createTestRequest(URL, { method: "POST", body: { token: TOKEN } }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.team).toEqual(TEAM)
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ teamId: TEAM.teamId, userId: "user-1", teamRole: "individual" }))
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1)
  })
})
