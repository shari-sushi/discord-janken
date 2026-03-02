import { describe, it, expect } from "vitest"
import { customId } from "./customId"
import { extractMatchId, extractMessageId, extractType } from "./extractCustomIdParam"

describe("customId builder", () => {
  describe("success: 単一パラメータ", () => {
    it("success: matchId を含む custom_id を生成", () => {
      const result = customId("test_action").matchId("abc123")
      expect(result).toBe("test_action?match_id=abc123")
    })

    it("success: messageId を含む custom_id を生成", () => {
      const result = customId("test_action").messageId("msg456")
      expect(result).toBe("test_action?message_id=msg456")
    })

    it("success: type を含む custom_id を生成", () => {
      const result = customId("test_action").type("feedback")
      expect(result).toBe("test_action?type=feedback")
    })
  })

  describe("success: 生成と抽出の往復", () => {
    it("success: matchId の往復", () => {
      const id = customId("action").matchId("test-match-id")
      const extracted = extractMatchId(id)
      expect(extracted).toBe("test-match-id")
    })

    it("success: messageId の往復", () => {
      const id = customId("action").messageId("test-message-id")
      const extracted = extractMessageId(id)
      expect(extracted).toBe("test-message-id")
    })

    it("success: type の往復", () => {
      const id = customId("action").type("test-type")
      const extracted = extractType(id)
      expect(extracted).toBe("test-type")
    })
  })
})
