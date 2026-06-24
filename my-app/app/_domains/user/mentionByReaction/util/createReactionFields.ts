import { APIEmbedField } from "discord-api-types/v10"
import { ReactionFieldData } from "../types"

/**
 * リアクション情報をもとにEmbed Fieldを作成する（純粋関数）
 * userIds は取得上限まで（getAllReactionFields の maxUsers）、count はリアクションの真の総数。
 * 両者の差を「表示しきれなかった人数」として明示する。取得上限により value は 1024 文字に収まる前提なので、
 * メンション文字列の途中切り捨て（substring）は行わない（`<@id>` を割らない）。
 * @param reactionFields - リアクションフィールドデータ配列
 * @returns Embed Field配列
 */
export const createReactionFields = (reactionFields: ReactionFieldData[]): APIEmbedField[] => {
  return reactionFields.map((field) => {
    // ユーザーを完成形のメンションとして連結（途中で割れない）
    const mentions = field.userIds.map((userId) => `<@${userId}>`).join(" ")
    // count（真の総数）と表示数の差＝取得上限で表示しきれなかった人数
    const hiddenCount = field.count - field.userIds.length

    const value =
      field.userIds.length === 0
        ? "なし"
        : hiddenCount > 0
          ? `${mentions}\n…ほか ${hiddenCount} 人（多すぎるため一部のみ表示）`
          : mentions

    return {
      name: `${field.emojiName} (${field.count})`,
      value,
      inline: false,
    }
  })
}
