// cSpell:disable
import { describe, it, expect } from "vitest"
import { analyzeSummonersText } from "./analyzeSummonersText"

describe("analyzeSummonersText", () => {
  it("success: LTKダッシュラダーのテキストから自チームを除外して相手チームプレイヤーを返す", () => {
    const text = [
      "@sushi#magro @santakuro1225#1225 kimura @チャーシュウ#4118 @kimura#jp1 @kinoko#JP1 @月に変わってお仕置きよ#JP1 @グラタン#aaaaa @さんま#御殿 @じゅん じゅわー#jun @ろんふー#JP1 @ゆっけ#1122",
      "",
      "ZETA DIVISION — LTK Dash Ladder",
      "⚔️  マッチが成立しました！",
      "ジェバンニの計画通り VS おいももちおち隊",
    ].join("\n")

    // selfTeam は @なしのサモネ名で渡す（parseLine が @ を除去した形式）
    const selfTeam = ["sushi#magro", "santakuro1225#1225", "kimura#jp1"]
    const result = analyzeSummonersText(text, selfTeam)

    // 相手チームのプレイヤーが含まれる
    expect(result).toContainEqual({ name: "チャーシュウ#4118", checked: true })
    expect(result).toContainEqual({ name: "kinoko#JP1", checked: true })
    expect(result).toContainEqual({ name: "月に変わってお仕置きよ#JP1", checked: true })
    expect(result).toContainEqual({ name: "グラタン#aaaaa", checked: true })
    expect(result).toContainEqual({ name: "さんま#御殿", checked: true })
    expect(result).toContainEqual({ name: "じゅん じゅわー#jun", checked: true })
    expect(result).toContainEqual({ name: "ろんふー#JP1", checked: true })
    expect(result).toContainEqual({ name: "ゆっけ#1122", checked: true })

    // 自チームメンバーは除外される
    expect(result).not.toContainEqual({ name: "sushi#magro", checked: true })
    expect(result).not.toContainEqual({ name: "santakuro1225#1225", checked: true })
    expect(result).not.toContainEqual({ name: "kimura#jp1", checked: true })
  })
})
