import { describe, it, expect } from "vitest"
import { createReminderEmbeds } from "./createEmbeds"
import { APIEmbed } from "discord-api-types/v10"

describe("createReminderEmbeds", () => {
  // 仕様として固定の値のみ共通化
  const TIMER_TITLE = "⏰ タイマー通知"
  const DEFAULT_COLOR = 3447003
  const NO_MESSAGE_TEXT = "メッセージ：無し\n"

  it("success: route.tsでの使用例の再現（message, matchStatusContentあり、createdByなし）", () => {
    const message = "1分前だよー😎"
    const matchStatus = "🟥 レッドサイド：✅登録済み\n🟦 ブルーサイド：✍️未登録"

    // route.tsでの実際の呼び出し: createReminderEmbeds({ ...payload, matchStatusContent: ... }, [])
    const result = createReminderEmbeds(
      {
        message,
        createdBy: undefined,
        matchStatusContent: matchStatus,
      },
      [],
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: TIMER_TITLE,
      color: DEFAULT_COLOR,
      description: `メッセージ：${message}\n\n${matchStatus}`,
    })
    expect(result[0].author).toBeUndefined()
  })

  it("success: 全てundefinedの場合でもタイトルと「メッセージ：無し」が表示される", () => {
    const result = createReminderEmbeds(
      {
        message: undefined,
        createdBy: undefined,
        matchStatusContent: undefined,
      },
      [],
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: TIMER_TITLE,
      color: DEFAULT_COLOR,
      description: NO_MESSAGE_TEXT,
    })
    expect(result[0].author).toBeUndefined()
  })

  it("success: 全てのフィールドが設定されている場合", () => {
    const message = "試合開始5分前です"
    const userId = "123456789012345678"
    const matchStatus = "🟥 レッドサイド：✍️未登録\n🟦 ブルーサイド：✍️未登録"

    const result = createReminderEmbeds(
      {
        message,
        createdBy: userId,
        matchStatusContent: matchStatus,
      },
      [],
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: TIMER_TITLE,
      color: DEFAULT_COLOR,
      description: `メッセージ：${message}\n\n${matchStatus}`,
      author: {
        name: `<@${userId}>`,
      },
    })
  })

  it("success: suffixEmbedsが渡された場合、正しく結合される", () => {
    const message = "テストメッセージ"
    const suffixEmbeds: APIEmbed[] = [
      {
        title: "追加情報1",
        description: "詳細1",
        color: 0xff0000,
      },
      {
        title: "追加情報2",
        description: "詳細2",
        color: 0x00ff00,
      },
    ]

    const result = createReminderEmbeds(
      {
        message,
      },
      suffixEmbeds,
    )

    expect(result).toHaveLength(3)
    expect(result[0].title).toBe(TIMER_TITLE)
    expect(result[1]).toEqual(suffixEmbeds[0])
    expect(result[2]).toEqual(suffixEmbeds[1])
  })

  it("success: カスタムカラーが設定できる", () => {
    const message = "カスタムカラーテスト"
    const customColor = 0xff5733

    const result = createReminderEmbeds(
      {
        message,
      },
      [],
      customColor,
    )

    expect(result).toHaveLength(1)
    expect(result[0].color).toBe(customColor)
  })

  it("success: messageが空文字列の場合は「メッセージ：無し」が表示される", () => {
    const result = createReminderEmbeds(
      {
        message: "",
      },
      [],
    )

    expect(result).toHaveLength(1)
    expect(result[0].description).toBe(NO_MESSAGE_TEXT)
  })

  it("success: matchStatusContentのみ設定されている場合", () => {
    const matchStatus = "🟥 レッドサイド：✅登録済み\n🟦 ブルーサイド：✅登録済み"

    const result = createReminderEmbeds(
      {
        matchStatusContent: matchStatus,
      },
      [],
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: TIMER_TITLE,
      color: DEFAULT_COLOR,
      description: `${NO_MESSAGE_TEXT}\n${matchStatus}`,
    })
  })

  it("success: createdByが空文字列の場合、authorフィールドは設定されない", () => {
    const message = "テストメッセージ"

    const result = createReminderEmbeds(
      {
        message,
        createdBy: "",
      },
      [],
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: TIMER_TITLE,
      color: DEFAULT_COLOR,
      description: `メッセージ：${message}\n`,
    })
    expect(result[0].author).toBeUndefined()
  })

  it("success: createdByが空白のみの場合、authorフィールドは設定されない", () => {
    const message = "テストメッセージ"

    const result = createReminderEmbeds(
      {
        message,
        createdBy: "   ",
      },
      [],
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: TIMER_TITLE,
      color: DEFAULT_COLOR,
      description: `メッセージ：${message}\n`,
    })
    expect(result[0].author).toBeUndefined()
  })
})
