import { describe, it, expect } from "vitest"
import { createReactionEmbed } from "./createReactionEmbed"
import { ReactionFieldData } from "../types"

describe("createReactionEmbed", () => {
  it("success: リアクション情報から正しいEmbedを生成する", () => {
    // リアクションフィールドデータ
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

    // Embedを生成
    const result = createReactionEmbed({
      messageContent: "これはテストメッセージです",
      reactionFields,
      executor: "TestUser",
    })

    // 結果の検証
    expect(result).toEqual({
      title: "リアクションメンバー",
      description: "元メッセージ: これはテストメッセージです",
      fields: [
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
      ],
      footer: {
        text: "Created by TestUser",
      },
      color: 0x5865f2,
    })
  })

  it("success: メッセージが200文字より長い場合、descriptionが省略される", () => {
    const longMessage = "あ".repeat(250) // 200文字を超える長いメッセージ
    const reactionFields: ReactionFieldData[] = [
      {
        emojiName: "👍",
        count: 1,
        userIds: ["user1"],
      },
    ]

    const result = createReactionEmbed({
      messageContent: longMessage,
      reactionFields,
      executor: "TestUser",
    })

    expect(result.description).toContain("...")
    expect(result.description!.length).toBeLessThanOrEqual("元メッセージ: ".length + 200 + "...".length)
  })

  it("success: count が表示数を超える場合、embed の field に「…ほか N 人」が出る", () => {
    // userIds は取得上限で 3 件、count（真の総数）は 100 → 表示しきれなかったのは 97 人
    const reactionFields: ReactionFieldData[] = [
      {
        emojiName: "🔥",
        count: 100,
        userIds: ["user1", "user2", "user3"],
      },
    ]

    const result = createReactionEmbed({
      messageContent: "人気のメッセージ",
      reactionFields,
      executor: "TestUser",
    })

    expect(result.fields![0].value).toContain("<@user1>")
    expect(result.fields![0].value).toContain("…ほか 97 人（多すぎるため一部のみ表示）")
    expect(result.fields![0].value).not.toContain("...")
  })

  it("success: ユーザーIDが空の場合、「なし」が表示される", () => {
    const reactionFields: ReactionFieldData[] = [
      {
        emojiName: "😢",
        count: 0,
        userIds: [],
      },
    ]

    const result = createReactionEmbed({
      messageContent: "リアクションユーザーなし",
      reactionFields,
      executor: "TestUser",
    })

    expect(result.fields![0].value).toBe("なし")
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

    const result = createReactionEmbed({
      messageContent: "複数リアクション",
      reactionFields,
      executor: "TestUser",
    })

    expect(result.fields).toHaveLength(3)
    expect(result.fields![0].name).toBe("👍 (2)")
    expect(result.fields![1].name).toBe("👎 (1)")
    expect(result.fields![2].name).toBe("❤️ (3)")
  })

  it("success: executor名が正しくfooterに表示される", () => {
    const reactionFields: ReactionFieldData[] = [
      {
        emojiName: "✅",
        count: 1,
        userIds: ["user1"],
      },
    ]

    const result = createReactionEmbed({
      messageContent: "テスト",
      reactionFields,
      executor: "CustomExecutorName",
    })

    expect(result.footer!.text).toBe("Created by CustomExecutorName")
  })

  it("success: メッセージ内容がちょうど200文字の場合、省略されない", () => {
    const exactMessage = "あ".repeat(200) // ちょうど200文字
    const reactionFields: ReactionFieldData[] = [
      {
        emojiName: "📝",
        count: 1,
        userIds: ["user1"],
      },
    ]

    const result = createReactionEmbed({
      messageContent: exactMessage,
      reactionFields,
      executor: "TestUser",
    })

    expect(result.description).not.toContain("...")
    expect(result.description).toBe(`元メッセージ: ${exactMessage}`)
  })
})
