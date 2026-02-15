import { CLIENT_ACTIONS } from "@/app/util/commands"
import { NextResponse } from "next/server"
import { appendFeedbackToSheet } from "@/app/libs/googleSheets"
import { StringSelectOption } from "discord-interactions"

// フィードバック種類
type FeedBackType = "bugs" | "opinion" | "miss-operation" | "other"

// コマンド初期表示
export const feedbackCommand = () => {
  return NextResponse.json({
    type: 4, // メッセージを返す
    data: {
      content: "フィードバックの種類を選択してください",
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 3, // String Select Menu
              custom_id: CLIENT_ACTIONS.SELECT_FEEDBACK_TYPE,
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
      flags: 64, // EPHEMERAL - 送信者のみに表示
    },
  })
}

// フィードバック種類選択処理
export const handleSelectFeedbackType = (selectedType: FeedBackType) => {
  return NextResponse.json({
    type: 9, // モーダルを開く
    data: {
      custom_id: `${CLIENT_ACTIONS.SUBMIT_FEEDBACK}?type=${selectedType}`,
      title: "フィードバック",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "feedback_name",
              label: "お名前（任意）",
              style: 1, // 短いテキスト
              required: false,
              placeholder: "例：太郎",
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "feedback_content",
              label: "内容（必須）",
              style: 2, // 長いテキスト（パラグラフ）
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handleSubmitFeedback = async (interaction: any) => {
  const customId = interaction.data.custom_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components = interaction.data.components as any[]

  // custom_idからフィードバックの種類を取得
  const customIdParams = new URLSearchParams(customId.split("?")[1] || "")
  const type = customIdParams.get("type") || ""

  // componentsからお名前と内容を取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const name = components.find((c: any) => c.components[0]?.custom_id === "feedback_name")?.components[0]?.value || ""
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = components.find((c: any) => c.components[0]?.custom_id === "feedback_content")?.components[0]?.value || ""

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
      type: 4,
      data: {
        content: "フィードバックを送信しました。ありがとうございます！",
        flags: 64, // EPHEMERAL - 送信者のみに表示
      },
    })
  } catch (error) {
    console.error("Error submitting feedback:", error)
    return NextResponse.json({
      type: 4,
      data: {
        content: "フィードバックの送信に失敗しました。もう一度お試しください。",
        flags: 64, // EPHEMERAL
      },
    })
  }
}
