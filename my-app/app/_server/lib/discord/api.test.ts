import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getReactionUsers, getAllReactionFields, DiscordApiError, DiscordReaction } from "./api"

// fetch をモック化（fetchWithRetry.test.ts の vi.stubGlobal 流儀に倣う）
const mockFetch = vi.fn()

// リアクションユーザー（DiscordReactor）を n 件ぶん生成する（id は連番）
const makeReactors = (count: number, startIndex = 0) =>
  Array.from({ length: count }, (_, i) => ({
    id: `user-${startIndex + i}`,
    username: `name-${startIndex + i}`,
    discriminator: "0001",
    avatar: null,
  }))

const okResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const errorResponse = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, statusText: "ERR" })

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getReactionUsers", () => {
  it("success: 100件ちょうどなら次ページを取得し、空ページで終端する", async () => {
    // 1ページ目: 100件（=ページ上限なので次を辿る）、2ページ目: 0件（終端）
    mockFetch.mockResolvedValueOnce(okResponse(makeReactors(100))).mockResolvedValueOnce(okResponse(makeReactors(0)))

    const users = await getReactionUsers("c", "m", "👍", { intervalMs: 0 })

    expect(users).toHaveLength(100)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    // 1ページ目は after なし、limit=100
    expect(mockFetch.mock.calls[0][0]).toContain("limit=100")
    expect(mockFetch.mock.calls[0][0]).not.toContain("after=")
    // 2ページ目は 1ページ目末尾ユーザー（user-99）を after に渡す
    expect(mockFetch.mock.calls[1][0]).toContain("after=user-99")
  })

  it("success: 100件超（150件）は ?after= で2ページ取得して連結する", async () => {
    // 1ページ目: 100件、2ページ目: 50件（<100 なので終端）
    mockFetch.mockResolvedValueOnce(okResponse(makeReactors(100, 0))).mockResolvedValueOnce(okResponse(makeReactors(50, 100)))

    const users = await getReactionUsers("c", "m", "👍", { intervalMs: 0 })

    expect(users).toHaveLength(150)
    expect(users[149].id).toBe("user-149")
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][0]).toContain("after=user-99")
  })

  it("success: 100件未満なら1ページで終端する（after を辿らない）", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(makeReactors(3)))

    const users = await getReactionUsers("c", "m", "👍", { intervalMs: 0 })

    expect(users).toHaveLength(3)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("success: 429 を1回返した後 200 なら retryAfterRateLimit で1回リトライして成功する", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(429, { retry_after: 0 })).mockResolvedValueOnce(okResponse(makeReactors(2)))

    const users = await getReactionUsers("c", "m", "👍", { intervalMs: 0 })

    expect(users).toHaveLength(2)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("failure: 403 はリトライせず DiscordApiError を throw する", async () => {
    mockFetch.mockResolvedValue(errorResponse(403))

    await expect(getReactionUsers("c", "m", "👍", { intervalMs: 0 })).rejects.toBeInstanceOf(DiscordApiError)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("success: maxUsers を指定すると上限で取得を打ち切る（ページングしない）", async () => {
    // 1ページ目に 100 件返るが、maxUsers=40 なので 1 リクエストで打ち切り 40 件に切り揃える
    mockFetch.mockResolvedValueOnce(okResponse(makeReactors(100)))

    const users = await getReactionUsers("c", "m", "👍", { intervalMs: 0, maxUsers: 40 })

    expect(users).toHaveLength(40)
    // 上限到達で次ページを辿らない＝fetch は 1 回のみ
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

describe("getAllReactionFields", () => {
  it("success: 複数絵文字を逐次（並列でなく直列）に取得して field 化する", async () => {
    // fetch 呼び出しの順序を記録し、絵文字ごとに直列で呼ばれていることを確認する
    const callOrder: string[] = []
    mockFetch.mockImplementation((url: string) => {
      callOrder.push(decodeURIComponent(url))
      // どの絵文字でも1ページ（<100件）で終端
      return Promise.resolve(okResponse(makeReactors(1)))
    })

    const reactions: DiscordReaction[] = [
      { emoji: { id: null, name: "👍" }, count: 1, me: false },
      { emoji: { id: null, name: "🎉" }, count: 1, me: false },
    ]

    const fields = await getAllReactionFields("c", "m", reactions, { intervalMs: 0 })

    expect(fields).toHaveLength(2)
    expect(fields[0]).toEqual({ emojiName: "👍", count: 1, userIds: ["user-0"] })
    expect(fields[1]).toEqual({ emojiName: "🎉", count: 1, userIds: ["user-0"] })
    // 絵文字ごとに1リクエスト（各1ページで終端）→ 計2回。並列なら順序が保証されないが、ここでは順序通り
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(callOrder[0]).toContain("👍")
    expect(callOrder[1]).toContain("🎉")
  })

  it("success: カスタム絵文字は name:id 形式でエンコードして取得する", async () => {
    mockFetch.mockResolvedValue(okResponse(makeReactors(1)))

    const reactions: DiscordReaction[] = [{ emoji: { id: "custom123", name: "myEmoji" }, count: 1, me: false }]

    const fields = await getAllReactionFields("c", "m", reactions, { intervalMs: 0 })

    expect(fields[0].emojiName).toBe("myEmoji")
    expect(decodeURIComponent(mockFetch.mock.calls[0][0])).toContain("myEmoji:custom123")
  })

  it("success: maxUsers を渡すと各 field の userIds は上限以下になる", async () => {
    // 1ページ目に 100 件返るが maxUsers=40 で打ち切る
    mockFetch.mockResolvedValue(okResponse(makeReactors(100)))

    const reactions: DiscordReaction[] = [{ emoji: { id: null, name: "👍" }, count: 100, me: false }]

    const fields = await getAllReactionFields("c", "m", reactions, { intervalMs: 0, maxUsers: 40 })

    // count はリアクションの真の総数（100）、userIds は上限で切り詰めた 40 件（非対称）
    expect(fields[0].count).toBe(100)
    expect(fields[0].userIds).toHaveLength(40)
    expect(fields[0].userIds.length).toBeLessThanOrEqual(40)
  })
})
