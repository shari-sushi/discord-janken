import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, PUT } from "./route"
import { createTestRequest } from "@/__tests__/helpers/api-test-utils"

const mockGetSessionUserId = vi.fn()
const mockGetTeamRole = vi.fn()
vi.mock("@/app/_domains/teamSchedules/_server/authz", () => ({
  getSessionUserId: (...args: unknown[]) => mockGetSessionUserId(...args),
  getTeamRole: (...args: unknown[]) => mockGetTeamRole(...args),
}))

// DB モック。GET の select 結果と、PUT の insert/update/delete 呼び出しを観測する
let selectResult: Record<string, unknown>[] = []
const selectWhere = vi.fn(async () => selectResult)
const selectFrom = vi.fn(() => ({ where: selectWhere }))
const select = vi.fn((..._a: unknown[]) => ({ from: selectFrom }))

const onConflictDoUpdate = vi.fn(async () => undefined)
const insertValues = vi.fn(() => ({ onConflictDoUpdate }))
const insert = vi.fn((..._a: unknown[]) => ({ values: insertValues }))

let updateReturningResult: Record<string, unknown>[] = [{ slot: "own" }]
const updateReturning = vi.fn(async () => updateReturningResult)
const updateWhere = vi.fn(() => ({ returning: updateReturning }))
const updateSet = vi.fn(() => ({ where: updateWhere }))
const update = vi.fn((..._a: unknown[]) => ({ set: updateSet }))

const deleteWhere = vi.fn(async () => undefined)
const del = vi.fn((..._a: unknown[]) => ({ where: deleteWhere }))

vi.mock("@/app/_server/lib/db", () => ({
  db: {
    select: (...a: unknown[]) => select(...a),
    insert: (...a: unknown[]) => insert(...a),
    update: (...a: unknown[]) => update(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}))

const TEAM_ID = "123e4567-e89b-42d3-a456-426614174000"
const URL = `http://localhost:3000/api/web/team-schedules/teams/${TEAM_ID}/webhooks`
const ctxFor = () => ({ params: Promise.resolve({ teamId: TEAM_ID }) })
const VALID_URL = "https://discord.com/api/webhooks/123/abcDEF"

beforeEach(() => {
  vi.clearAllMocks()
  selectResult = []
  updateReturningResult = [{ slot: "own" }]
})

describe("GET /team-schedules/teams/[teamId]/webhooks", () => {
  it("failure: 未ログインなら401", async () => {
    mockGetSessionUserId.mockResolvedValue(null)
    const res = await GET(createTestRequest(URL, { method: "GET" }), ctxFor())
    expect(res.status).toBe(401)
  })

  it("failure: member（admin相当未満）は404（存在隠匿）", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("member")
    const res = await GET(createTestRequest(URL, { method: "GET" }), ctxFor())
    expect(res.status).toBe(404)
  })

  it("success: master は生 URL を含めて返す", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("master")
    selectResult = [{ slot: "own", provider: "discord", webhookUrl: VALID_URL, notifyActivityReached: true }]
    const res = await GET(createTestRequest(URL, { method: "GET" }), ctxFor())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.webhooks[0].webhookUrl).toBe(VALID_URL)
    expect(json.webhooks[0].maskedUrl).toBeNull()
  })

  it("success: admin（非master）は生 URL を伏せ、maskedUrl だけ返す", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("admin")
    selectResult = [{ slot: "own", provider: "discord", webhookUrl: VALID_URL, notifyActivityReached: true }]
    const res = await GET(createTestRequest(URL, { method: "GET" }), ctxFor())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.webhooks[0].webhookUrl).toBeNull()
    expect(json.webhooks[0].maskedUrl).toContain("https://discord.com/")
    expect(json.webhooks[0].configured).toBe(true)
  })
})

describe("PUT /team-schedules/teams/[teamId]/webhooks", () => {
  it("failure: member は404（書き込みしない）", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("member")
    const res = await PUT(createTestRequest(URL, { method: "PUT", body: { own: { webhookUrl: VALID_URL } } }), ctxFor())
    expect(res.status).toBe(404)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: 不正な URL は400（書き込みしない）", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("admin")
    const res = await PUT(createTestRequest(URL, { method: "PUT", body: { own: { webhookUrl: "https://example.com/x" } } }), ctxFor())
    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it("success: admin が URL を渡すと upsert される", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("admin")
    const res = await PUT(createTestRequest(URL, { method: "PUT", body: { own: { webhookUrl: VALID_URL, notifyActivityReached: false } } }), ctxFor())
    expect(res.status).toBe(200)
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ slot: "own", webhookUrl: VALID_URL, notifyActivityReached: false }))
  })

  it("success: トグルのみ（URLなし）は既存行を update する", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("admin")
    const res = await PUT(createTestRequest(URL, { method: "PUT", body: { own: { notifyActivityReached: false } } }), ctxFor())
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledTimes(1)
    expect(insert).not.toHaveBeenCalled()
  })

  it("failure: トグルのみだが対象行が無ければ400", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("admin")
    updateReturningResult = [] // 更新対象なし
    const res = await PUT(createTestRequest(URL, { method: "PUT", body: { shared: { notifyActivityReached: true } } }), ctxFor())
    expect(res.status).toBe(400)
  })

  it("success: null を渡すとその枠を削除する", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("admin")
    const res = await PUT(createTestRequest(URL, { method: "PUT", body: { own: null } }), ctxFor())
    expect(res.status).toBe(200)
    expect(del).toHaveBeenCalledTimes(1)
  })

  it("failure: 中身が空のオブジェクトは400", async () => {
    mockGetSessionUserId.mockResolvedValue("u1")
    mockGetTeamRole.mockResolvedValue("admin")
    const res = await PUT(createTestRequest(URL, { method: "PUT", body: { own: {} } }), ctxFor())
    expect(res.status).toBe(400)
  })
})
