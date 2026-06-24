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

  it("success: count が表示数を超える場合、「…ほか N 人」を付与する", () => {
    // userIds は取得上限で 3 件のみ、count（真の総数）は 10 → 表示しきれなかったのは 7 人
    const reactionFields: ReactionFieldData[] = [
      {
        emojiName: "🔥",
        count: 10,
        userIds: ["user1", "user2", "user3"],
      },
    ]

    const result = createReactionFields(reactionFields)

    // 取得できた 3 件のメンションは全て含む（途中で割れない）
    expect(result[0].value).toContain("<@user1>")
    expect(result[0].value).toContain("<@user2>")
    expect(result[0].value).toContain("<@user3>")
    // 超過件数（10 - 3 = 7）を明示する
    expect(result[0].value).toContain("…ほか 7 人（多すぎるため一部のみ表示）")
    // substring 切り捨ては行わないので末尾省略記号は付かない
    expect(result[0].value).not.toContain("...")
  })

  it("success: count と表示数が一致する場合、超過通知を付けない", () => {
    const reactionFields: ReactionFieldData[] = [
      {
        emojiName: "👍",
        count: 3,
        userIds: ["user1", "user2", "user3"],
      },
    ]

    const result = createReactionFields(reactionFields)

    expect(result[0].value).toBe("<@user1> <@user2> <@user3>")
    expect(result[0].value).not.toContain("ほか")
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
