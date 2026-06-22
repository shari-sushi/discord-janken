import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"

const mockGetSessionUserId = vi.fn()
const mockGetTeamRole = vi.fn()
vi.mock("@/app/_domains/teamSchedules/_server/authz", () => ({
  getSessionUserId: (...args: unknown[]) => mockGetSessionUserId(...args),
  getTeamRole: (...args: unknown[]) => mockGetTeamRole(...args),
}))

const mockSendWebhookTest = vi.fn(async (_provider: string, _webhookUrl: string) => undefined)
vi.mock("@/app/_domains/teamSchedules/_server/notify", () => ({
  sendWebhookTest: (provider: string, webhookUrl: string) => mockSendWebhookTest(provider, webhookUrl),
}))

const TEAM_ID = "123e4567-e89b-42d3-a456-426614174000"
const URL = `http://localhost:3000/api/web/team-schedules/teams/${TEAM_ID}/webhooks/test`
const ctxFor = () => ({ params: Promise.resolve({ teamId: TEAM_ID }) })
const VALID_URL = "https://discord.com/api/webhooks/123/abcDEF"

beforeEach(() => {
  vi.clearAllMocks()
  mockSendWebhookTest.mockResolvedValue(undefined)
})

describe("POST /team-schedules/teams/[teamId]/webhooks/test", () => {
  it("failure: 未ログインなら401（送信しない）", async () => {
    mockGetSessionUserId.mockResolvedValue(null)
    const res = await POST(createTestRequest(URL, { method: "POST", body: { webhookUrl: VALID_URL } }), ctxFor())
    expect(res.status).toBe(401)
    expect(mockSendWebhookTest).not.toHaveBeenCalled()
  })

  it("failure: member（admin相当未満）は404（送信しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("member")
    const res = await POST(createTestRequest(URL, { method: "POST", body: { webhookUrl: VALID_URL } }), ctxFor())
    expect(res.status).toBe(404)
    expect(mockSendWebhookTest).not.toHaveBeenCalled()
  })

  it("failure: 不正な URL は400（送信しない）", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("admin")
    const res = await POST(createTestRequest(URL, { method: "POST", body: { webhookUrl: "https://example.com/x" } }), ctxFor())
    expect(res.status).toBe(400)
    expect(mockSendWebhookTest).not.toHaveBeenCalled()
  })

  it("success: admin は与えた URL にテスト送信できる", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("admin")
    const res = await POST(createTestRequest(URL, { method: "POST", body: { webhookUrl: VALID_URL } }), ctxFor())
    expect(res.status).toBe(200)
    expect(mockSendWebhookTest).toHaveBeenCalledWith("discord", VALID_URL)
  })

  it("failure: 送信に失敗したら502", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("admin")
    mockSendWebhookTest.mockRejectedValue(new Error("HTTP 401"))
    const res = await POST(createTestRequest(URL, { method: "POST", body: { webhookUrl: VALID_URL } }), ctxFor())
    expect(res.status).toBe(502)
  })
})
