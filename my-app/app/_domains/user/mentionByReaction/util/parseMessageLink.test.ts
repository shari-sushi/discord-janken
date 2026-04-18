import { describe, it, expect } from "vitest"
import { parseMessageLink } from "./parseMessageLink"

describe("parseMessageLink", () => {
  it("success: 正しいDiscordメッセージリンクをパースできる", () => {
    const link = "https://discord.com/channels/123456789/987654321/111222333"
    const result = parseMessageLink(link)

    expect(result).toEqual({
      guildId: "123456789",
      channelId: "987654321",
      messageId: "111222333",
    })
  })

  it("success: httpでも正しくパースできる", () => {
    const link = "http://discord.com/channels/123456789/987654321/111222333"
    const result = parseMessageLink(link)

    expect(result).toEqual({
      guildId: "123456789",
      channelId: "987654321",
      messageId: "111222333",
    })
  })

  it("success: URLの前後に文字列があってもパースできる", () => {
    const link = "このメッセージを見て https://discord.com/channels/123456789/987654321/111222333 です"
    const result = parseMessageLink(link)

    expect(result).toEqual({
      guildId: "123456789",
      channelId: "987654321",
      messageId: "111222333",
    })
  })

  it("success: URLパラメータがあってもパースできる", () => {
    const link = "https://discord.com/channels/123456789/987654321/111222333?some=param"
    const result = parseMessageLink(link)

    expect(result).toEqual({
      guildId: "123456789",
      channelId: "987654321",
      messageId: "111222333",
    })
  })

  it("failure: 不正なリンク形式の場合はnullを返す", () => {
    const link = "https://discord.com/invalid/link"
    const result = parseMessageLink(link)

    expect(result).toBeNull()
  })

  it("failure: Discord以外のURLの場合はnullを返す", () => {
    const link = "https://example.com/channels/123456789/987654321/111222333"
    const result = parseMessageLink(link)

    expect(result).toBeNull()
  })

  it("failure: 部分的に一致するが不完全なURLの場合はnullを返す", () => {
    const link = "https://discord.com/channels/123456789/987654321"
    const result = parseMessageLink(link)

    expect(result).toBeNull()
  })

  it("failure: 空文字列の場合はnullを返す", () => {
    const link = ""
    const result = parseMessageLink(link)

    expect(result).toBeNull()
  })

  it("failure: IDが数字以外の場合はnullを返す", () => {
    const link = "https://discord.com/channels/abc/def/ghi"
    const result = parseMessageLink(link)

    expect(result).toBeNull()
  })

  it("failure: channelsの綴りが間違っている場合はnullを返す", () => {
    const link = "https://discord.com/channel/123456789/987654321/111222333"
    const result = parseMessageLink(link)

    expect(result).toBeNull()
  })
})
