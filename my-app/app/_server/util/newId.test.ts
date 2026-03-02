import { describe, it, expect } from "vitest"
import { newId } from "./newId"

describe("newId", () => {
  it("success:UUID v4 フォーマットのIDを生成する", () => {
    const id = newId()

    // UUID v4 のフォーマット: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    expect(id).toMatch(uuidV4Regex)
  })

  it("success:呼び出すたびに異なるIDを生成する", () => {
    const id1 = newId()
    const id2 = newId()
    const id3 = newId()

    expect(id1).not.toBe(id2)
    expect(id1).not.toBe(id3)
    expect(id2).not.toBe(id3)
  })

  it("success:生成されたIDは36文字である", () => {
    const id = newId()

    expect(id.length).toBe(36)
  })
})
