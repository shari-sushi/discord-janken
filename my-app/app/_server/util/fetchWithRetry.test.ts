import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchWithRetry } from "./fetchWithRetry"

// backoff は 1ms にして実待ちを無視できるようにする
const FAST = { maxAttempts: 3, backoffMs: [1, 1], timeoutMs: 1000 }

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchWithRetry", () => {
  it("success: 初回成功なら1回だけ呼んでレスポンスを返す", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }))
    const res = await fetchWithRetry("https://example.com", undefined, FAST)
    expect(res.status).toBe(204)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("success: 例外で失敗→次で成功すればリトライして返す", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(new Response(null, { status: 200 }))
    const res = await fetchWithRetry("https://example.com", undefined, FAST)
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("failure: 非2xxが続いたら maxAttempts まで試して throw する", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }))
    await expect(fetchWithRetry("https://example.com", undefined, FAST)).rejects.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it("failure: 例外が続いたら maxAttempts まで試して最後のエラーを throw する", async () => {
    mockFetch.mockRejectedValue(new Error("boom"))
    await expect(fetchWithRetry("https://example.com", undefined, FAST)).rejects.toThrow("boom")
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it("success: 各試行に AbortSignal を渡している（タイムアウト用）", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 200 }))
    await fetchWithRetry("https://example.com", { method: "POST" }, FAST)
    const init = mockFetch.mock.calls[0][1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.method).toBe("POST")
  })
})
