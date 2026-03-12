import { NextResponse } from "next/server"
import { getDiscordMessage, getAllReactionFields } from "@/app/_server/lib/discord/api"
import { createReactionEmbed } from "@/app/domains/user/mentionByReaction/util/createReactionEmbed"
import { parseMessageLink } from "@/app/domains/user/mentionByReaction/util/parseMessageLink"
import {
  APIApplicationCommandInteractionDataBasicOption,
  APIApplicationCommandInteractionDataOption,
  APIChatInputApplicationCommandInteraction,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from "discord-api-types/v10"

// コマンド初期表示
export const mentionReactorsCommand = async (interaction: APIChatInputApplicationCommandInteraction) => {
  // オプションからメッセージリンクを取得
  const options = interaction.data?.options as Array<{ name: string; value: string }> | undefined
  const messageLink = options?.find((opt) => opt.name === "message_link")?.value

  if (!messageLink) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "メッセージリンクが指定されていません",
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  // メッセージリンクをパース
  const parsed = parseMessageLink(messageLink)
  if (!parsed) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "不正なメッセージリンクです。Discord のメッセージを右クリックして「メッセージのリンクをコピー」で取得してください。",
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  try {
    // メッセージ情報を取得
    const message = await getDiscordMessage(parsed.channelId, parsed.messageId)

    // リアクションがない場合
    if (!message.reactions || message.reactions.length === 0) {
      return NextResponse.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "指定されたメッセージにはリアクションがありません",
          flags: MessageFlags.Ephemeral,
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
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [embed],
      },
    })
  } catch (error) {
    console.error("Error fetching message or reactions:", error)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "メッセージまたはリアクション情報の取得に失敗しました。Bot に該当チャンネルへのアクセス権限があるか確認してください。",
        flags: MessageFlags.Ephemeral,
      },
    })
  }
}

// 型ガード: valueプロパティを持つ基本オプションかどうか
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const isBasicOption = (
  opt: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommand>,
): opt is APIApplicationCommandInteractionDataBasicOption<InteractionType.ApplicationCommand> => {
  return "value" in opt
}
