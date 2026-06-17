import { describe, it, expect, vi, afterEach } from "vitest"
import { extractMatchId, extractMessageId, extractType } from "./extractCustomIdParam"

describe("extractMatchId", () => {
  it("success: match_id を抽出", () => {
    const result = extractMatchId("action?match_id=123")
    expect(result).toBe("123")
  })

  it("failure: match_id が存在しない場合は undefined", () => {
    const result = extractMatchId("action?other_param=123")
    expect(result).toBeUndefined()
  })
})

describe("extractMessageId", () => {
  it("success: message_id を抽出", () => {
    const result = extractMessageId("action?message_id=456")
    expect(result).toBe("456")
  })

  it("failure: message_id が存在しない場合は undefined", () => {
    const result = extractMessageId("action?other_param=456")
    expect(result).toBeUndefined()
  })
})

describe("extractType", () => {
  it("success: type を抽出", () => {
    const result = extractType("action?type=bug")
    expect(result).toBe("bug")
  })

  it("failure: type が存在しない場合は undefined", () => {
    const result = extractType("action?other_param=bug")
    expect(result).toBeUndefined()
  })
})

describe("warnIfMissing オプション", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("success: 値があれば warnIfMissing:true でもログを出さない", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const result = extractMatchId("action?match_id=123", { warnIfMissing: true })
    expect(result).toBe("123")
    expect(spy).not.toHaveBeenCalled()
  })

  it("success: 値が無く warnIfMissing 未指定なら（デフォルト）ログを出さない", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const result = extractMatchId("action?other_param=123")
    expect(result).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
  })

  it("failure: 値が無く warnIfMissing:true ならログを出す", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const result = extractMatchId("action?other_param=123", { warnIfMissing: true })
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalledOnce()
  })
})
