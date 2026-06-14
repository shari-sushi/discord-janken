import { APIEmbed } from "discord-api-types/v10"
import { ReactionFieldData } from "../types"
import { createReactionFields } from "./createReactionFields"

/**
 * リアクションメンバー表示用のEmbedを作成する（純粋関数）
 * @param options - Embed作成オプション
 * @returns Discord Embed
 */
export const createReactionEmbed = (options: { messageContent: string; reactionFields: ReactionFieldData[]; executor: string }): APIEmbed => {
  const { messageContent, reactionFields, executor } = options

  // リアクション情報からEmbed Fieldを作成
  const fields = createReactionFields(reactionFields)

  // Embedメッセージを作成
  const embed: APIEmbed = {
    title: "リアクションメンバー",
    description: `元メッセージ: ${messageContent.substring(0, 200)}${messageContent.length > 200 ? "..." : ""}`,
    fields,
    footer: {
      text: `Created by ${executor}`,
    },
    color: 0x5865f2, // Blurple color
  }

  return embed
}
