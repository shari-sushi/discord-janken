import { NextResponse } from "next/server"
import { InteractionResponseType, InteractionResponseFlags } from "discord-interactions"
import { getDiscordMessage, getAllReactionFields } from "@/app/_server/lib/discord/api"
import { DiscordInteraction } from "@/app/_server/lib/discord/types"
import { createReactionEmbed } from "@/app/domains/user/mentionByReaction/util/createReactionEmbed"
import { parseMessageLink } from "@/app/domains/user/mentionByReaction/util/parseMessageLink"

// コマンド初期表示
export const mentionReactorsCommand = async (interaction: DiscordInteraction) => {
  // オプションからメッセージリンクを取得
  const options = interaction.data?.options as Array<{ name: string; value: string }> | undefined
  const messageLink = options?.find((opt) => opt.name === "message_link")?.value

  if (!messageLink) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "メッセージリンクが指定されていません",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  // メッセージリンクをパース
  const parsed = parseMessageLink(messageLink)
  if (!parsed) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "不正なメッセージリンクです。Discord のメッセージを右クリックして「メッセージのリンクをコピー」で取得してください。",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  try {
    // メッセージ情報を取得
    const message = await getDiscordMessage(parsed.channelId, parsed.messageId)

    // リアクションがない場合
    if (!message.reactions || message.reactions.length === 0) {
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "指定されたメッセージにはリアクションがありません",
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      })
    }

    // コマンド実行者の情報を取得
    const executor = interaction.member?.nick || interaction.member?.user?.username || interaction.user?.username || "不明"

    // リアクションごとにユーザーリストを取得（並列実行）
    const reactionFields = await getAllReactionFields(parsed.channelId, parsed.messageId, message.reactions)

    // Embedメッセージを作成
    const embed = createReactionEmbed({
      messageContent: message.content,
      reactionFields,
      executor,
    })

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [embed],
      },
    })
  } catch (error) {
    console.error("Error fetching message or reactions:", error)
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "メッセージまたはリアクション情報の取得に失敗しました。Bot に該当チャンネルへのアクセス権限があるか確認してください。",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }
}
