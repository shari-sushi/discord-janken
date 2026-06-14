import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { DISCORD_APPLICATION_ID } from "@/app/_server/lib/env"
import { addReactions, deleteAllReactions, editWebhookOriginalMessage, getReactionUsers, getWebhookOriginalMessage, DiscordApiError } from "@/app/_server/lib/discord/api"
import { ROLE_EMOJIS, ROLE_KEYS, ROLE_LABELS, RoleKey, runRoleRoulette } from "@/app/_domains/lol/roleRoulette"
import { NextResponse } from "next/server"
import { after } from "next/server"
import { APIChatInputApplicationCommandInteraction, APIMessageComponentInteraction, ButtonStyle, ComponentType, InteractionResponseType } from "discord-api-types/v10"
import type { APIActionRowComponent, APIComponentInMessageActionRow } from "discord-api-types/v10"

const ROULETTE_MESSAGE_CONTENT = `やれるロールのリアクションをしてください。
1️⃣ TOP
2️⃣ JG
3️⃣ MID
4️⃣ ADC
5️⃣ SUP
*️⃣ fill`

function createRoleRouletteButtons(): APIActionRowComponent<APIComponentInMessageActionRow>[] {
  return [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Primary,
          label: "抽選開始",
          custom_id: CLIENT_ACTIONS.LOL.ROLE_ROULETTE_START,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          label: "リセット",
          custom_id: CLIENT_ACTIONS.LOL.ROLE_ROULETTE_RESET,
        },
      ],
    },
  ]
}

// スラッシュコマンド受信時
export const roleRouletteCommand = (interaction: APIChatInputApplicationCommandInteraction): NextResponse => {
  const { token, application_id, channel } = interaction

  after(async () => {
    // セットアップ：メッセージ取得・編集
    let messageId: string
    let channelId: string
    try {
      const original = await getWebhookOriginalMessage(application_id, token)
      messageId = original.id
      channelId = channel?.id ?? original.channel_id
      await editWebhookOriginalMessage(application_id, token, ROULETTE_MESSAGE_CONTENT, createRoleRouletteButtons())
    } catch (e) {
      console.error("roleRouletteCommand setup error:", e)
      return
    }

    // リアクション追加：権限不足の場合はエラーメッセージを表示
    try {
      await addReactions(channelId, messageId, Object.values(ROLE_EMOJIS))
    } catch (e) {
      console.error("roleRouletteCommand reaction error:", e instanceof DiscordApiError ? JSON.stringify(e.details) : e)
      if (e instanceof DiscordApiError && e.status === 403) {
        try {
          await editWebhookOriginalMessage(
            application_id,
            token,
            "⚠️ Botに「リアクションを追加する」権限がないため、リアクションを付けられませんでした。\n" +
              "サーバー管理者に権限の付与を依頼してください。\n" +
              "・「リアクションの追加」権限\n" +
              "・コマンドを実行したチャンネルがプライベートの場合は、その「閲覧権限」",
          )
        } catch (editError) {
          console.error("roleRouletteCommand error message edit failed:", editError)
        }
      }
    }
  })

  return NextResponse.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  })
}

// 抽選開始ボタン押下時
export const handleRoleRouletteStart = (interaction: APIMessageComponentInteraction): NextResponse => {
  const channelId = interaction.channel?.id ?? ""
  const messageId = interaction.message.id
  const { token, application_id } = interaction

  after(async () => {
    try {
      const intervalMs = 300
      // 各ロール絵文字のリアクションユーザーを順番に取得（並列だとrate limitに引っかかるため）
      const topUsers = await getReactionUsers(channelId, messageId, ROLE_EMOJIS.TOP)
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      const jgUsers = await getReactionUsers(channelId, messageId, ROLE_EMOJIS.JG)
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      const midUsers = await getReactionUsers(channelId, messageId, ROLE_EMOJIS.MID)
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      const adcUsers = await getReactionUsers(channelId, messageId, ROLE_EMOJIS.ADC)
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      const supUsers = await getReactionUsers(channelId, messageId, ROLE_EMOJIS.SUP)
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      const fillUsers = await getReactionUsers(channelId, messageId, ROLE_EMOJIS.FILL)

      // userId -> username マップ構築
      const userNameMap: Record<string, string> = {}
      for (const user of [...topUsers, ...jgUsers, ...midUsers, ...adcUsers, ...supUsers, ...fillUsers]) {
        userNameMap[user.id] = user.username
      }

      const reactorsByRole = {
        TOP: topUsers.map((u) => u.id),
        JG: jgUsers.map((u) => u.id),
        MID: midUsers.map((u) => u.id),
        ADC: adcUsers.map((u) => u.id),
        SUP: supUsers.map((u) => u.id),
        FILL: fillUsers.map((u) => u.id),
      }

      const result = runRoleRoulette(reactorsByRole, DISCORD_APPLICATION_ID)

      if (!result.ok) {
        await editWebhookOriginalMessage(application_id, token, result.error)
        return
      }

      // 結果フォーマット
      const lines = ROLE_KEYS.map((role: RoleKey) => `${ROLE_LABELS[role]}: <@${result.assignment[role]}>`)
      if (result.rest.length > 0) {
        const restNames = result.rest.map((id) => userNameMap[id] ?? id).join(", ")
        lines.push(`休憩: ${restNames}`)
      }

      const content = `抽選結果：\n${lines.join("\n")}`
      await editWebhookOriginalMessage(application_id, token, content)
    } catch (e) {
      console.error("handleRoleRouletteStart after error:", e)
      let errorMessage = "⚠️ 抽選中にエラーが発生しました。しばらく待ってから再度お試しください。"
      if (e instanceof DiscordApiError && e.status === 429) {
        errorMessage =
          "⚠️ Discord APIのレートリミットに達したため、リアクション情報を取得できませんでした。\n" +
          "時間をおいてから再度お試しください。"
      } else if (e instanceof DiscordApiError && e.status === 403) {
        errorMessage =
          "⚠️ Botに「リアクションを読み取る」権限がないため、抽選できませんでした。\n" +
          "サーバー管理者に権限の付与を依頼してください。\n" +
          "・「メッセージ履歴を読む」権限\n" +
          "・コマンドを実行したチャンネルがプライベートの場合は、その「閲覧権限」"
      }
      try {
        await editWebhookOriginalMessage(application_id, token, errorMessage)
      } catch (editError) {
        console.error("handleRoleRouletteStart error message edit failed:", editError)
      }
    }
  })

  return NextResponse.json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  })
}

// リセットボタン押下時
export const handleRoleRouletteReset = (interaction: APIMessageComponentInteraction): NextResponse => {
  const channelId = interaction.channel?.id ?? ""
  const messageId = interaction.message.id
  const { token, application_id } = interaction

  after(async () => {
    try {
      await deleteAllReactions(channelId, messageId)
    } catch (e) {
      console.error("handleRoleRouletteReset deleteAllReactions error:", e instanceof DiscordApiError ? JSON.stringify(e.details) : e)
      if (e instanceof DiscordApiError && e.status === 403) {
        try {
          await editWebhookOriginalMessage(
            application_id,
            token,
            "⚠️ 権限不足でリアクション全削除ができませんでした。\n" +
              "サーバー管理者に権限の付与を依頼してください。\n" +
              "・「メッセージの管理」権限\n" +
              "・コマンドを実行したチャンネルがプライベートの場合は、その「閲覧権限」",
          )
        } catch (editError) {
          console.error("handleRoleRouletteReset error message edit failed:", editError)
        }
      }
      return
    }

    try {
      await addReactions(channelId, messageId, Object.values(ROLE_EMOJIS))
    } catch (e) {
      console.error("handleRoleRouletteReset reaction error:", e instanceof DiscordApiError ? JSON.stringify(e.details) : e)
      if (e instanceof DiscordApiError && e.status === 403) {
        try {
          await editWebhookOriginalMessage(
            application_id,
            token,
            "⚠️ Botに「リアクションを追加する」権限がないため、リアクションを付けられませんでした。\n" +
              "サーバー管理者に権限の付与を依頼してください。\n" +
              "・「リアクションの追加」権限\n" +
              "・「メッセージの管理」権限\n" +
              "・コマンドを実行したチャンネルがプライベートの場合は、その「閲覧権限」",
          )
        } catch (editError) {
          console.error("handleRoleRouletteReset error message edit failed:", editError)
        }
      }
    }
  })

  return NextResponse.json({
    type: InteractionResponseType.DeferredMessageUpdate,
  })
}
