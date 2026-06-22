import { describe, it, expect } from "vitest"
import { isScheduleStatus, isDayKey, isValidNote, isUuid, isWebhookSlot, isWebhookProvider, isDiscordWebhookUrl } from "./validators"

describe("teamSchedules validators", () => {
  describe("isScheduleStatus", () => {
    it("success: ok / maybe / ng を受理する", () => {
      expect(isScheduleStatus("ok")).toBe(true)
      expect(isScheduleStatus("maybe")).toBe(true)
      expect(isScheduleStatus("ng")).toBe(true)
    })

    it("failure: 未回答を表す値や未知の文字列は拒否する", () => {
      expect(isScheduleStatus("none")).toBe(false)
      expect(isScheduleStatus("")).toBe(false)
      expect(isScheduleStatus(null)).toBe(false)
      expect(isScheduleStatus(undefined)).toBe(false)
      expect(isScheduleStatus(1)).toBe(false)
    })
  })

  describe("isDayKey", () => {
    it("success: YYYY-MM-DD 形式を受理する", () => {
      expect(isDayKey("2026-06-14")).toBe(true)
      expect(isDayKey("2026-12-31")).toBe(true)
    })

    it("failure: 形式違い・非文字列は拒否する", () => {
      expect(isDayKey("2026/06/14")).toBe(false)
      expect(isDayKey("2026-6-14")).toBe(false)
      expect(isDayKey("14-06-2026")).toBe(false)
      expect(isDayKey("")).toBe(false)
      expect(isDayKey(null)).toBe(false)
      expect(isDayKey(20260614)).toBe(false)
    })
  })

  describe("isValidNote", () => {
    it("success: null・通常の文字列を受理する", () => {
      expect(isValidNote(null)).toBe(true)
      expect(isValidNote("")).toBe(true)
      expect(isValidNote("21:00~")).toBe(true)
      expect(isValidNote("a".repeat(200))).toBe(true)
    })

    it("failure: 長すぎる文字列・非文字列は拒否する", () => {
      expect(isValidNote("a".repeat(201))).toBe(false)
      expect(isValidNote(123)).toBe(false)
      expect(isValidNote(undefined)).toBe(false)
    })
  })

  describe("isUuid", () => {
    it("success: UUID v4 形式を受理する", () => {
      expect(isUuid("123e4567-e89b-42d3-a456-426614174000")).toBe(true)
      expect(isUuid("123E4567-E89B-42D3-A456-426614174000")).toBe(true) // 大文字も許容
    })

    it("failure: UUID v4 以外・形式違いは拒否する", () => {
      expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(false) // version=1
      expect(isUuid("123e4567-e89b-42d3-c456-426614174000")).toBe(false) // variant 不正(c)
      expect(isUuid("own")).toBe(false)
      expect(isUuid("123e4567e89b42d3a456426614174000")).toBe(false)
      expect(isUuid("")).toBe(false)
      expect(isUuid(null)).toBe(false)
    })
  })

  describe("isWebhookSlot", () => {
    it("success: own / shared を受理する", () => {
      expect(isWebhookSlot("own")).toBe(true)
      expect(isWebhookSlot("shared")).toBe(true)
    })
    it("failure: 未知の値は拒否する", () => {
      expect(isWebhookSlot("both")).toBe(false)
      expect(isWebhookSlot("")).toBe(false)
      expect(isWebhookSlot(null)).toBe(false)
    })
  })

  describe("isWebhookProvider", () => {
    it("success: discord を受理する", () => {
      expect(isWebhookProvider("discord")).toBe(true)
    })
    it("failure: 未対応の provider は拒否する", () => {
      expect(isWebhookProvider("slack")).toBe(false)
      expect(isWebhookProvider("")).toBe(false)
      expect(isWebhookProvider(null)).toBe(false)
    })
  })

  describe("isDiscordWebhookUrl", () => {
    it("success: Discord 受信 Webhook URL を受理する", () => {
      expect(isDiscordWebhookUrl("https://discord.com/api/webhooks/123456789/abcDEF-_123")).toBe(true)
      expect(isDiscordWebhookUrl("https://discordapp.com/api/webhooks/123/tok_en")).toBe(true)
      expect(isDiscordWebhookUrl("https://ptb.discord.com/api/webhooks/123/token")).toBe(true)
    })
    it("failure: 別ホスト・http・形式違い・長すぎ・非文字列は拒否する", () => {
      expect(isDiscordWebhookUrl("https://example.com/api/webhooks/123/token")).toBe(false)
      expect(isDiscordWebhookUrl("http://discord.com/api/webhooks/123/token")).toBe(false)
      expect(isDiscordWebhookUrl("https://discord.com/api/webhooks/")).toBe(false)
      expect(isDiscordWebhookUrl("https://discord.com/api/webhooks/123")).toBe(false)
      expect(isDiscordWebhookUrl("https://discord.com/api/webhooks/123/" + "a".repeat(300))).toBe(false)
      expect(isDiscordWebhookUrl(null)).toBe(false)
    })
  })
})
