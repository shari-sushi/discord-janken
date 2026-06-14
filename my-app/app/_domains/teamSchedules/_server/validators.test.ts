import { describe, it, expect } from "vitest"
import { isScheduleStatus, isDayKey, isValidNote, isUuid } from "./validators"

describe("teamSchedules validators", () => {
  describe("isScheduleStatus", () => {
    it("success: ok / maybe / ng を受理する", () => {
      expect(isScheduleStatus("ok")).toBe(true)
      expect(isScheduleStatus("maybe")).toBe(true)
      expect(isScheduleStatus("ng")).toBe(true)
    })

    it("failure: 未記入を表す値や未知の文字列は拒否する", () => {
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
    it("success: UUID形式を受理する", () => {
      expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true)
    })

    it("failure: UUID以外は拒否する", () => {
      expect(isUuid("own")).toBe(false)
      expect(isUuid("123e4567e89b12d3a456426614174000")).toBe(false)
      expect(isUuid("")).toBe(false)
      expect(isUuid(null)).toBe(false)
    })
  })
})
