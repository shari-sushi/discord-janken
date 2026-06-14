import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"
import { redisSet } from "@/app/_server/lib/redis/redis"

// 認可ヘルパーをモック（未ログイン401・非admin404・admin200 のロジックを route 単体で検証する）
const mockGetSessionUserId = vi.fn()
const mockAssertTeamAdmin = vi.fn()
vi.mock("@/app/_domains/teamSchedules/_server/authz", () => ({
  getSessionUserId: (...args: unknown[]) => mockGetSessionUserId(...args),
  assertTeamAdmin: (...args: unknown[]) => mockAssertTeamAdmin(...args),
}))

const TEAM_ID = "123e4567-e89b-42d3-a456-426614174000"
const URL = `http://localhost:3000/api/web/team-schedules/teams/${TEAM_ID}/invite`
const ctxFor = (teamId: string = TEAM_ID) => ({ params: Promise.resolve({ teamId }) })

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /team-schedules/teams/[teamId]/invite", () => {
  it("failure: 不正なteamId（非UUID）は404（招待を発行しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    const res = await POST(createTestRequest(URL, { method: "POST" }), ctxFor("own"))
    expect(res.status).toBe(404)
    expect(redisSet).not.toHaveBeenCalled()
  })

  it("failure: 未ログインなら401（招待を発行しない）", async () => {
    mockGetSessionUserId.mockResolvedValue(null)
    const res = await POST(createTestRequest(URL, { method: "POST" }), ctxFor())
    expect(res.status).toBe(401)
    expect(redisSet).not.toHaveBeenCalled()
  })

  it("failure: admin でなければ404（存在を隠す・招待を発行しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockAssertTeamAdmin.mockResolvedValue(false)
    const res = await POST(createTestRequest(URL, { method: "POST" }), ctxFor())
    expect(res.status).toBe(404)
    expect(redisSet).not.toHaveBeenCalled()
  })

  it("success: admin なら招待トークンをRedisに保存し、参加用URLを返す", async () => {
    mockGetSessionUserId.mockResolvedValue("user-1")
    mockAssertTeamAdmin.mockResolvedValue(true)
    const res = await POST(createTestRequest(URL, { method: "POST" }), ctxFor())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.url).toContain("/team_schedules?join=")
    expect(json.expiryDays).toBe(7)
    // ts:invite:<token> として TTL 付きで保存される
    expect(redisSet).toHaveBeenCalledTimes(1)
    const [key, payload] = (redisSet as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    expect(key).toMatch(/^ts:invite:/)
    expect(payload).toEqual({ teamId: TEAM_ID })
  })
})
