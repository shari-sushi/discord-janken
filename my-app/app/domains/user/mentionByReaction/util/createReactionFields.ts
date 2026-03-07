import { DiscordEmbedField } from "@/app/_server/lib/discord/types"
import { ReactionFieldData } from "../types"

/**
 * リアクション情報をもとにEmbed Fieldを作成する（純粋関数）
 * @param reactionFields - リアクションフィールドデータ配列
 * @returns Embed Field配列
 */
export const createReactionFields = (reactionFields: ReactionFieldData[]): DiscordEmbedField[] => {
  return reactionFields.map((field) => {
    // ユーザーをメンション形式に変換
    const mentions = field.userIds.map((userId) => `<@${userId}>`).join(" ")

    // Embedフィールドは1024文字まで
    const truncatedMentions = mentions.length > 1024 ? mentions.substring(0, 1021) + "..." : mentions

    return {
      name: `${field.emojiName} (${field.count})`,
      value: truncatedMentions || "なし",
      inline: false,
    }
  })
}
