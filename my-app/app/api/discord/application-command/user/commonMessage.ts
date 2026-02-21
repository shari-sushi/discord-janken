import { CLIENT_ACTIONS } from "@/app/util/commands"
import { NextResponse } from "next/server"
import { editDiscordMessage, sendDiscordMessage } from "@/app/libs/discord/api"
import { ActionRow, MessageComponentTypes, ButtonStyleTypes, TextStyleTypes } from "discord-interactions"

// コマンド初期表示（モーダルを表示）
export const commonMessageCommand = () => {
  // 初回投稿用モーダルを表示
  const modalComponents: ActionRow[] = [
    {
      type: MessageComponentTypes.ACTION_ROW,
      components: [
        {
          type: MessageComponentTypes.INPUT_TEXT,
          custom_id: "common_message_content",
          label: "メッセージ内容",
          style: TextStyleTypes.PARAGRAPH,
          required: true,
          max_length: 2000, // Discord メッセージの上限
          placeholder: "メッセージを入力してください",
        },
      ],
    },
  ]

  return NextResponse.json({
    type: 9, // MODAL
    data: {
      custom_id: CLIENT_ACTIONS.USER.SUBMIT_NEW_COMMON_MESSAGE,
      title: "共有メッセージを投稿",
      components: modalComponents,
    },
  })
}

// 初回投稿用モーダル送信処理
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handleSubmitNewCommonMessage = async (interaction: any) => {
  const channelId = interaction.channel_id || ""
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components = interaction.data.components as any[]

  // components から新しいテキストを取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = components.find((c: any) => c.components[0]?.custom_id === "common_message_content")?.components[0]?.value || ""

  // バリデーション
  if (!channelId) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "エラー: チャンネルIDが取得できませんでした",
        flags: 64, // EPHEMERAL
      },
    })
  }

  if (content.length > 2000) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "エラー: メッセージが長すぎます（2000文字以下にしてください）\n\nDiscordおよびDiscord Botに課金すると文字数制限を緩められる場合があります。",
        flags: 64,
      },
    })
  }

  if (content.trim().length === 0) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "エラー: メッセージが空です",
        flags: 64,
      },
    })
  }

  // メッセージを投稿（編集ボタン付き）
  try {
    await sendDiscordMessage(channelId, content, createEditButton(false, false))

    return NextResponse.json({
      type: 4,
      data: {
        content: "✅ 投稿しました",
        flags: 64, // EPHEMERAL - 送信者のみに表示
      },
    })
  } catch (error) {
    console.error("Failed to send message:", error)
    return NextResponse.json({
      type: 4,
      data: {
        content: "エラー: メッセージの投稿に失敗しました。もう一度お試しください。",
        flags: 64,
      },
    })
  }
}

// 編集ボタンのコンポーネントを作成
function createEditButton(disabled: boolean, includeForceEnd: boolean): ActionRow[] {
  const components: ActionRow[] = [
    {
      type: MessageComponentTypes.ACTION_ROW,
      components: [
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.PRIMARY,
          label: disabled ? "編集中..." : "編集",
          custom_id: CLIENT_ACTIONS.USER.OPEN_MODAL_EDIT_COMMON_MESSAGE,
          disabled,
        },
      ],
    },
  ]

  // 編集中の場合は「編集中を強制終了」ボタンを追加
  if (includeForceEnd) {
    components.push({
      type: MessageComponentTypes.ACTION_ROW,
      components: [
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.DANGER,
          label: "編集中を強制終了",
          custom_id: CLIENT_ACTIONS.USER.FORCE_END_EDITING_COMMON_MESSAGE,
        },
      ],
    })
  }

  return components
}

// 編集ボタン押下処理
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handleOpenModalEditCommonMessage = async (interaction: any) => {
  const messageId = interaction.message?.id || ""
  const channelId = interaction.channel_id || ""
  const currentContent = interaction.message?.content || ""

  // 文字数制限チェック（Discord のモーダル input は 4000 文字まで、メッセージは 2000 文字まで）
  if (currentContent.length > 4000) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "エラー: メッセージが長すぎるため編集できません（4000文字以下にしてください）",
        flags: 64, // EPHEMERAL
      },
    })
  }

  // メッセージのボタンをdisableにして「編集中」にする
  try {
    await editDiscordMessage(channelId, messageId, currentContent, createEditButton(true, true))
  } catch (error) {
    console.error("Failed to disable edit button:", error)
    return NextResponse.json({
      type: 4,
      data: {
        content: "エラー: ボタンの更新に失敗しました",
        flags: 64,
      },
    })
  }

  // モーダルを表示
  const modalComponents: ActionRow[] = [
    {
      type: MessageComponentTypes.ACTION_ROW,
      components: [
        {
          type: MessageComponentTypes.INPUT_TEXT,
          custom_id: "common_message_content",
          label: "メッセージ内容",
          style: TextStyleTypes.PARAGRAPH,
          required: true,
          value: currentContent, // 現在のテキストをデフォルト値としてセット
          max_length: 2000, // Discord メッセージの上限
          placeholder: "メッセージを入力してください",
        },
      ],
    },
  ]

  return NextResponse.json({
    type: 9, // MODAL
    data: {
      custom_id: `${CLIENT_ACTIONS.USER.SUBMIT_COMMON_MESSAGE}?message_id=${messageId}`,
      title: "共有メッセージを編集",
      components: modalComponents,
    },
  })
}

// モーダル送信処理（メッセージ編集）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handleSubmitCommonMessage = async (interaction: any) => {
  const customId = interaction.data.custom_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components = interaction.data.components as any[]

  const params = new URLSearchParams(customId.split("?")[1] || "")
  const messageId = params.get("message_id") || ""
  const channelId = interaction.channel_id || ""

  // components から新しいテキストを取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newContent = components.find((c: any) => c.components[0]?.custom_id === "common_message_content")?.components[0]?.value || ""

  // バリデーション
  if (!messageId || !channelId) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "エラー: メッセージIDまたはチャンネルIDが取得できませんでした",
        flags: 64, // EPHEMERAL
      },
    })
  }

  if (newContent.length > 2000) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "エラー: メッセージが長すぎます（2000文字以下にしてください）\n\nDiscordおよびDiscord Botに課金すると文字数制限を緩められる場合があります。",
        flags: 64,
      },
    })
  }

  // メッセージを編集（編集ボタンを元に戻す）
  try {
    await editDiscordMessage(channelId, messageId, newContent, createEditButton(false, false))

    return NextResponse.json({
      type: 4,
      data: {
        content: "✅ 編集しました",
        flags: 64, // EPHEMERAL - 送信者のみに表示
      },
    })
  } catch (error) {
    console.error("Failed to edit message:", error)
    return NextResponse.json({
      type: 4,
      data: {
        content: "エラー: メッセージの編集に失敗しました。もう一度お試しください。",
        flags: 64,
      },
    })
  }
}

// 編集中を強制終了する処理
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handleForceEndEditingCommonMessage = async (interaction: any) => {
  const messageId = interaction.message?.id || ""
  const channelId = interaction.channel_id || ""
  const currentContent = interaction.message?.content || ""

  if (!messageId || !channelId) {
    return NextResponse.json({
      type: 4,
      data: {
        content: "エラー: メッセージIDまたはチャンネルIDが取得できませんでした",
        flags: 64, // EPHEMERAL
      },
    })
  }

  // ボタンを通常の「編集」ボタンに戻す
  try {
    await editDiscordMessage(channelId, messageId, currentContent, createEditButton(false, false))

    return NextResponse.json({
      type: 4,
      data: {
        content: "✅ 編集を強制終了しました",
        flags: 64, // EPHEMERAL
      },
    })
  } catch (error) {
    console.error("Failed to force end editing:", error)
    return NextResponse.json({
      type: 4,
      data: {
        content: "エラー: 編集の強制終了に失敗しました",
        flags: 64,
      },
    })
  }
}
