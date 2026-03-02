import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { NextResponse } from "next/server"
import { editDiscordMessage, sendDiscordMessage } from "@/app/_server/lib/discord/api"
import { ActionRow, MessageComponentTypes, ButtonStyleTypes, TextStyleTypes, InteractionResponseType, InteractionResponseFlags } from "discord-interactions"
import { getValue } from "@/app/api/discord/util/getComponentValue"
import { DISCORD_MESSAGE_MAX_LENGTH } from "@/app/domains/user/commonMessage/_server/constants"
import { extractInteractionData } from "../../util/extractInteractionData"
import { DiscordInteraction } from "@/app/_server/lib/discord/types"
import { extractMessageId } from "../../util/extractCustomIdParam"
import { customId } from "../../util/customId"

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
          max_length: DISCORD_MESSAGE_MAX_LENGTH,
          placeholder: "メッセージを入力してください",
        },
      ],
    },
  ]

  return NextResponse.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: CLIENT_ACTIONS.USER.SUBMIT_NEW_COMMON_MESSAGE,
      title: "共有メッセージを投稿",
      components: modalComponents,
    },
  })
}

// 初回投稿用モーダル送信処理
export const handleSubmitNewCommonMessage = async (interaction: DiscordInteraction) => {
  const channelId = interaction.channel_id || ""

  // components から新しいテキストを取得
  const content = getValue("common_message_content", interaction.data) || ""

  // バリデーション
  if (!channelId) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "エラー: チャンネルIDが取得できませんでした",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  if (content.length > DISCORD_MESSAGE_MAX_LENGTH) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `エラー: メッセージが長すぎます（${DISCORD_MESSAGE_MAX_LENGTH}文字以下にしてください）\n\nDiscordおよびDiscord Botに課金すると文字数制限を緩められる場合があります。`,
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  if (content.trim().length === 0) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "エラー: メッセージが空です",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  // メッセージを投稿（編集ボタン付き）
  try {
    await sendDiscordMessage(channelId, content, createEditButton(false, false))

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "✅ 投稿しました",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  } catch (error) {
    console.error("Failed to send message:", error)
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "エラー: メッセージの投稿に失敗しました。もう一度お試しください。",
        flags: InteractionResponseFlags.EPHEMERAL,
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
export const handleOpenModalEditCommonMessage = async (interaction: DiscordInteraction) => {
  const messageId = interaction.message?.id || ""
  const channelId = interaction.channel_id || ""
  const currentContent = interaction.message?.content || ""

  // 文字数制限チェック（Discord のモーダル input は 4000 文字まで、メッセージは 2000 文字まで）
  if (currentContent.length > 4000) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "エラー: メッセージが長すぎるため編集できません（4000文字以下にしてください）",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  // メッセージのボタンをdisableにして「編集中」にする
  try {
    await editDiscordMessage(channelId, messageId, currentContent, createEditButton(true, true))
  } catch (error) {
    console.error("Failed to disable edit button:", error)
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "エラー: ボタンの更新に失敗しました",
        flags: InteractionResponseFlags.EPHEMERAL,
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
          max_length: DISCORD_MESSAGE_MAX_LENGTH,
          placeholder: "メッセージを入力してください",
        },
      ],
    },
  ]

  return NextResponse.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: customId(CLIENT_ACTIONS.USER.SUBMIT_COMMON_MESSAGE).messageId(messageId),
      title: "共有メッセージを編集",
      components: modalComponents,
    },
  })
}

// モーダル送信処理（メッセージ編集）
export const handleSubmitCommonMessage = async (interaction: DiscordInteraction) => {
  const { customId } = extractInteractionData(interaction)
  if (!customId) {
    console.error("custom_id is not found")
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "エラー: メッセージの編集に失敗しました。もう一度お試しください。",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  const messageId = extractMessageId(customId) || ""
  const channelId = interaction.channel_id || ""

  // components から新しいテキストを取得
  const newContent = getValue("common_message_content", interaction.data) || ""

  // バリデーション
  if (!messageId || !channelId) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "エラー: メッセージIDまたはチャンネルIDが取得できませんでした",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  if (newContent.length > 2000) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "エラー: メッセージが長すぎます（2000文字以下にしてください）\n\nDiscordおよびDiscord Botに課金すると文字数制限を緩められる場合があります。",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  // メッセージを編集（編集ボタンを元に戻す）
  try {
    await editDiscordMessage(channelId, messageId, newContent, createEditButton(false, false))

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "✅ 編集しました",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  } catch (error) {
    console.error("Failed to edit message:", error)
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "エラー: メッセージの編集に失敗しました。もう一度お試しください。",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }
}

// 編集中を強制終了する処理
export const handleForceEndEditingCommonMessage = async (interaction: DiscordInteraction) => {
  const messageId = interaction.message?.id || ""
  const channelId = interaction.channel_id || ""
  const currentContent = interaction.message?.content || ""

  if (!messageId || !channelId) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "エラー: メッセージIDまたはチャンネルIDが取得できませんでした",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }

  // ボタンを通常の「編集」ボタンに戻す
  try {
    await editDiscordMessage(channelId, messageId, currentContent, createEditButton(false, false))

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "✅ 編集を強制終了しました",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  } catch (error) {
    console.error("Failed to force end editing:", error)
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "エラー: 編集の強制終了に失敗しました",
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    })
  }
}
