import { describe, it, expect } from "vitest"
import { DISCORD_MESSAGE_MAX_LENGTH, validateDiscordMessageContent } from "./discordMessage"

describe("validateDiscordMessageContent", () => {
  it("success: 通常の本文は ok", () => {
    expect(validateDiscordMessageContent("活動可能になりました")).toEqual({ ok: true })
  })

  it("success: ちょうど上限文字数なら ok", () => {
    expect(validateDiscordMessageContent("a".repeat(DISCORD_MESSAGE_MAX_LENGTH))).toEqual({ ok: true })
  })

  it("failure: 空文字は弾く", () => {
    const r = validateDiscordMessageContent("")
    expect(r.ok).toBe(false)
  })

  it("failure: 上限超過は弾く", () => {
    const r = validateDiscordMessageContent("a".repeat(DISCORD_MESSAGE_MAX_LENGTH + 1))
    expect(r.ok).toBe(false)
  })

  it("failure: 既定では @everyone を弾く", () => {
    const r = validateDiscordMessageContent("やあ @everyone")
    expect(r.ok).toBe(false)
  })

  it("failure: 既定では @here を弾く", () => {
    const r = validateDiscordMessageContent("やあ @here")
    expect(r.ok).toBe(false)
  })

  it("success: everyone を許可すれば @everyone を通す", () => {
    expect(validateDiscordMessageContent("やあ @everyone", { everyone: true })).toEqual({ ok: true })
  })

  it("success: here を許可すれば @here を通す", () => {
    expect(validateDiscordMessageContent("やあ @here", { here: true })).toEqual({ ok: true })
  })

  it("failure: here だけ許可しても @everyone は弾く", () => {
    const r = validateDiscordMessageContent("@everyone", { here: true })
    expect(r.ok).toBe(false)
  })
})
