import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { NextResponse } from "next/server"
import { editDiscordMessage, sendDiscordMessage } from "@/app/_server/lib/discord/api"
import { getValue } from "@/app/api/discord/util/getComponentValue"
import { DISCORD_MESSAGE_MAX_LENGTH } from "@/app/_domains/user/commonMessage/_server/constants"
import { extractModalSubmitInteractionData } from "../../util/extractModalSubmitInteractionData"
import { extractMessageId } from "../../util/extractCustomIdParam"
import { customId } from "../../util/customId"
import {
  APIActionRowComponent,
  APIComponentInMessageActionRow,
  APIMessageComponentInteraction,
  APIModalInteractionResponseCallbackComponent,
  APIModalSubmitInteraction,
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  MessageFlags,
  TextInputStyle,
} from "discord-api-types/v10"

// コマンド初期表示（モーダルを表示）
export const commonMessageCommand = () => {
  // 初回投稿用モーダルを表示
  const modalComponent: APIModalInteractionResponseCallbackComponent = {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.TextInput,
        custom_id: "common_message_content",
        label: "メッセージ内容",
        style: TextInputStyle.Paragraph,
        required: true,
        max_length: DISCORD_MESSAGE_MAX_LENGTH,
        placeholder: "メッセージを入力してください",
      },
    ],
  }

  return NextResponse.json({
    type: InteractionResponseType.Modal,
    data: {
      custom_id: CLIENT_ACTIONS.USER.SUBMIT_NEW_COMMON_MESSAGE,
      title: "共有メッセージを投稿",
      components: [modalComponent],
    },
  })
}

// 初回投稿用モーダル送信処理
export const handleSubmitNewCommonMessage = async (interaction: APIModalSubmitInteraction) => {
  const channelId = interaction.channel?.id || ""

  // components から新しいテキストを取得
  const content = getValue("common_message_content", interaction.data) || ""

  // バリデーション
  if (!channelId) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "エラー: チャンネルIDが取得できませんでした",
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  if (content.length > DISCORD_MESSAGE_MAX_LENGTH) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `エラー: メッセージが長すぎます（${DISCORD_MESSAGE_MAX_LENGTH}文字以下にしてください）\n\nDiscordおよびDiscord Botに課金すると文字数制限を緩められる場合があります。`,
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  if (content.trim().length === 0) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "エラー: メッセージが空です",
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  // メッセージを投稿（編集ボタン付き）
  try {
    await sendDiscordMessage(channelId, content, createEditButton(false, false))

    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "✅ 投稿しました",
        flags: MessageFlags.Ephemeral,
      },
    })
  } catch (error) {
    console.error("Failed to send message:", error)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "エラー: メッセージの投稿に失敗しました。もう一度お試しください。",
        flags: MessageFlags.Ephemeral,
      },
    })
  }
}

// 編集ボタンのコンポーネントを作成
function createEditButton(disabled: boolean, includeForceEnd: boolean): APIActionRowComponent<APIComponentInMessageActionRow>[] {
  const components: APIActionRowComponent<APIComponentInMessageActionRow>[] = [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Primary,
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
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Danger,
          label: "編集中を強制終了",
          custom_id: CLIENT_ACTIONS.USER.FORCE_END_EDITING_COMMON_MESSAGE,
        },
      ],
    })
  }

  return components
}

// 編集ボタン押下処理
export const handleOpenModalEditCommonMessage = async (interaction: APIMessageComponentInteraction) => {
  const messageId = interaction.message?.id || ""
  const channelId = interaction.channel_id || ""
  const currentContent = interaction.message?.content || ""

  // 文字数制限チェック（Discord のモーダル input は 4000 文字まで、メッセージは 2000 文字まで）
  if (currentContent.length > 4000) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "エラー: メッセージが長すぎるため編集できません（4000文字以下にしてください）",
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  // メッセージのボタンをdisableにして「編集中」にする
  try {
    await editDiscordMessage(channelId, messageId, currentContent, createEditButton(true, true))
  } catch (error) {
    console.error("Failed to disable edit button:", error)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "エラー: ボタンの更新に失敗しました",
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  // モーダルを表示
  const modalComponent: APIModalInteractionResponseCallbackComponent = {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.TextInput,
        custom_id: "common_message_content",
        label: "メッセージ内容",
        style: TextInputStyle.Paragraph,
        required: true,
        value: currentContent, // 現在のテキストをデフォルト値としてセット
        max_length: DISCORD_MESSAGE_MAX_LENGTH,
        placeholder: "メッセージを入力してください",
      },
    ],
  }

  return NextResponse.json({
    type: InteractionResponseType.Modal,
    data: {
      custom_id: customId(CLIENT_ACTIONS.USER.SUBMIT_COMMON_MESSAGE).messageId(messageId),
      title: "共有メッセージを編集",
      components: [modalComponent],
    },
  })
}

// モーダル送信処理（メッセージ編集）
export const handleSubmitCommonMessage = async (interaction: APIModalSubmitInteraction) => {
  const { customId } = extractModalSubmitInteractionData(interaction)
  if (!customId) {
    console.error("custom_id is not found")
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "エラー: メッセージの編集に失敗しました。もう一度お試しください。",
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  const messageId = extractMessageId(customId) || ""
  const channelId = interaction.channel?.id || ""

  // components から新しいテキストを取得
  const newContent = getValue("common_message_content", interaction.data) || ""

  // バリデーション
  if (!messageId || !channelId) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "エラー: メッセージIDまたはチャンネルIDが取得できませんでした",
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  if (newContent.length > 2000) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "エラー: メッセージが長すぎます（2000文字以下にしてください）\n\nDiscordおよびDiscord Botに課金すると文字数制限を緩められる場合があります。",
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  // メッセージを編集（編集ボタンを元に戻す）
  try {
    await editDiscordMessage(channelId, messageId, newContent, createEditButton(false, false))

    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "✅ 編集しました",
        flags: MessageFlags.Ephemeral,
      },
    })
  } catch (error) {
    console.error("Failed to edit message:", error)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "エラー: メッセージの編集に失敗しました。もう一度お試しください。",
        flags: MessageFlags.Ephemeral,
      },
    })
  }
}

// 編集中を強制終了する処理
export const handleForceEndEditingCommonMessage = async (interaction: APIMessageComponentInteraction) => {
  const messageId = interaction.message?.id || ""
  const channelId = interaction.channel_id || ""
  const currentContent = interaction.message?.content || ""

  if (!messageId || !channelId) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "エラー: メッセージIDまたはチャンネルIDが取得できませんでした",
        flags: MessageFlags.Ephemeral,
      },
    })
  }

  // ボタンを通常の「編集」ボタンに戻す
  try {
    await editDiscordMessage(channelId, messageId, currentContent, createEditButton(false, false))

    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "✅ 編集を強制終了しました",
        flags: MessageFlags.Ephemeral,
      },
    })
  } catch (error) {
    console.error("Failed to force end editing:", error)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "エラー: 編集の強制終了に失敗しました",
        flags: MessageFlags.Ephemeral,
      },
    })
  }
}
