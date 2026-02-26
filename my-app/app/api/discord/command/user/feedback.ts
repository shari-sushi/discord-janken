import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { NextResponse } from "next/server"
import { appendFeedbackToSheet } from "@/app/_server/lib/googleSheets"
import { StringSelectOption, InteractionResponseType, InteractionResponseFlags, MessageComponentTypes, TextStyleTypes } from "discord-interactions"
import { DiscordInteraction } from "@/app/_server/lib/discord/types"
import { getValue } from "@/app/api/discord/util/getComponentValue"
import { FeedBackType } from "@/app/domains/user/feedback/types"
import { extractInteractionData } from "../../util/extractInteractionData"

// コマンド初期表示
export const feedbackCommand = () => {
  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "フィードバックの種類を選択してください",
      components: [
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.STRING_SELECT,
              custom_id: CLIENT_ACTIONS.USER.SELECT_FEEDBACK_TYPE,
              placeholder: "種類を選択...",
              options: [
                {
                  label: "不具合",
                  value: "bugs",
                },
                {
                  label: "意見・要望",
                  value: "opinion",
                },
                {
                  label: "操作ミスの体験",
                  value: "miss-operation",
                },
                {
                  label: "その他",
                  value: "other",
                },
              ] satisfies Array<StringSelectOption & { value: FeedBackType }>,
            },
          ],
        },
      ],
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  })
}

// フィードバック種類選択処理
export const handleSelectFeedbackType = (selectedType: FeedBackType) => {
  return NextResponse.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `${CLIENT_ACTIONS.USER.SUBMIT_FEEDBACK}?type=${selectedType}`,
      title: "フィードバック",
      components: [
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.INPUT_TEXT,
              custom_id: "feedback_name",
              label: "お名前（任意）",
              style: TextStyleTypes.SHORT,
              required: false,
              placeholder: "例：太郎",
            },
          ],
        },
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.INPUT_TEXT,
              custom_id: "feedback_content",
              label: "内容（必須）",
              style: TextStyleTypes.PARAGRAPH,
              required: true,
              placeholder: "フィードバック内容を入力してください",
            },
          ],
        },
      ],
    },
  })
}

// フィードバック送信処理
export const handleSubmitFeedback = async (interaction: DiscordInteraction) => {
  const { customId } = extractInteractionData(interaction)
  if (!customId) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "フィードバックの送信に失敗しました。もう一度お試しください。",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  // custom_idからフィードバックの種類を取得
  const customIdParams = new URLSearchParams(customId.split("?")[1] || "")
  const type = customIdParams.get("type") || ""

  // componentsからお名前と内容を取得
  const name = getValue("feedback_name", interaction.data)
  const content = getValue("feedback_content", interaction.data)
  if (!content) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "本文が必要です",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  const guildId = interaction.guild_id || ""
  const memberId = interaction.member?.user?.id || interaction.user?.id || ""

  try {
    await appendFeedbackToSheet({
      guildId,
      memberId,
      name,
      type,
      content,
    })

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "フィードバックを送信しました。ありがとうございます！",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  } catch (error) {
    console.error("Error submitting feedback:", error)
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "フィードバックの送信に失敗しました。もう一度お試しください。",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }
}
