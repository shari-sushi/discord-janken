import { describe, it, expect } from "vitest"
import { createReactionFields } from "./createReactionFields"
import { ReactionFieldData } from "../types"

describe("createReactionFields", () => {
  it("success: リアクション情報から正しいEmbed Fieldを生成する", () => {
    const reactionFields: ReactionFieldData[] = [
      {
        emojiName: "👍",
        count: 3,
        userIds: ["user1", "user2", "user3"],
      },
      {
        emojiName: "custom_emoji",
        count: 2,
        userIds: ["user4", "user5"],
      },
    ]

    const result = createReactionFields(reactionFields)

    expect(result).toEqual([
      {
        name: "👍 (3)",
        value: "<@user1> <@user2> <@user3>",
        inline: false,
      },
      {
        name: "custom_emoji (2)",
        value: "<@user4> <@user5>",
        inline: false,
      },
    ])
  })

  it("success: メンション文字列が1024文字を超える場合、省略される", () => {
    // 100ユーザー分のID（各ユーザーのメンションは約22文字 = `<@user_123456789012345678>`）
    const userIds = Array.from({ length: 100 }, (_, i) => `user_${i.toString().padStart(18, "0")}`)

    const reactionFields: ReactionFieldData[] = [
      {
        emojiName: "🔥",
        count: 100,
        userIds,
      },
    ]

    const result = createReactionFields(reactionFields)

    expect(result[0].value).toContain("...")
    expect(result[0].value.length).toBeLessThanOrEqual(1024)
  })

  it("success: ユーザーIDが空の場合、「なし」が表示される", () => {
    const reactionFields: ReactionFieldData[] = [
      {
        emojiName: "😢",
        count: 0,
        userIds: [],
      },
    ]

    const result = createReactionFields(reactionFields)

    expect(result[0].value).toBe("なし")
  })

  it("success: 複数のリアクションフィールドが正しく処理される", () => {
    const reactionFields: ReactionFieldData[] = [
      {
        emojiName: "👍",
        count: 2,
        userIds: ["user1", "user2"],
      },
      {
        emojiName: "👎",
        count: 1,
        userIds: ["user3"],
      },
      {
        emojiName: "❤️",
        count: 3,
        userIds: ["user4", "user5", "user6"],
      },
    ]

    const result = createReactionFields(reactionFields)

    expect(result).toHaveLength(3)
    expect(result[0].name).toBe("👍 (2)")
    expect(result[0].value).toBe("<@user1> <@user2>")
    expect(result[1].name).toBe("👎 (1)")
    expect(result[1].value).toBe("<@user3>")
    expect(result[2].name).toBe("❤️ (3)")
    expect(result[2].value).toBe("<@user4> <@user5> <@user6>")
  })

  it("success: 空の配列を渡した場合、空の配列を返す", () => {
    const result = createReactionFields([])
    expect(result).toEqual([])
  })
})
