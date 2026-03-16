import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { NextResponse } from "next/server"
import { appendFeedbackToSheet } from "@/app/_server/lib/googleSheets"
import { getValue } from "@/app/api/discord/_util/getComponentValue"
import { FeedBackType } from "@/app/domains/user/feedback/types"
import { extractModalSubmitInteractionData } from "../../_util/extractModalSubmitInteractionData"
import { extractType } from "../../_util/extractCustomIdParam"
import { customId } from "../../_util/customId"
import {
  APIModalInteractionResponseCallbackComponent,
  APIModalSubmitInteraction,
  APISelectMenuOption,
  ComponentType,
  InteractionResponseType,
  MessageFlags,
  TextInputStyle,
} from "discord-api-types/v10"

// コマンド初期表示
export const feedbackCommand = () => {
  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: "フィードバックの種類を選択してください",
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.StringSelect,
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
              ] satisfies Array<APISelectMenuOption & { value: FeedBackType }>,
            },
          ],
        },
      ],
      flags: MessageFlags.Ephemeral,
    },
  })
}

// フィードバック種類選択処理
export const handleSelectFeedbackType = (selectedType: FeedBackType) => {
  return NextResponse.json({
    type: InteractionResponseType.Modal,
    data: {
      custom_id: customId(CLIENT_ACTIONS.USER.SUBMIT_FEEDBACK).type(selectedType),
      title: "フィードバック",
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "feedback_name",
              label: "お名前（任意）",
              style: TextInputStyle.Short,
              required: false,
              placeholder: "例：太郎",
            },
          ],
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "feedback_content",
              label: "内容（必須）",
              style: TextInputStyle.Paragraph,
              required: true,
              placeholder: "フィードバック内容を入力してください",
            },
          ],
        },
      ] satisfies APIModalInteractionResponseCallbackComponent[],
    },
  })
}

// フィードバック送信処理
export const handleSubmitFeedback = async (interaction: APIModalSubmitInteraction) => {
  const { customId } = extractModalSubmitInteractionData(interaction)
  if (!customId) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "フィードバックの送信に失敗しました。もう一度お試しください。",
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  // custom_idからフィードバックの種類を取得
  const type = extractType(customId) || ""

  // componentsからお名前と内容を取得
  const name = getValue("feedback_name", interaction.data)
  const content = getValue("feedback_content", interaction.data)
  if (!content) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "本文が必要です",
        flags: MessageFlags.Ephemeral,
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
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "フィードバックを送信しました。ありがとうございます！",
        flags: MessageFlags.Ephemeral,
      },
    })
  } catch (error) {
    console.error("Error submitting feedback:", error)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "フィードバックの送信に失敗しました。もう一度お試しください。",
        flags: MessageFlags.Ephemeral,
      },
    })
  }
}
