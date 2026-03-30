import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { DISCORD_APPLICATION_ID } from "@/app/_server/lib/env"
import { addReaction, deleteAllReactions, editWebhookOriginalMessage, getReactionUsers, getWebhookOriginalMessage } from "@/app/_server/lib/discord/api"
import { ROLE_EMOJIS, ROLE_KEYS, ROLE_LABELS, RoleKey, runRoleRoulette } from "@/app/domains/lol/_server/roleRoulette"
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
    try {
      // 元メッセージを取得（IDとchannel.idが必要）
      const original = await getWebhookOriginalMessage(application_id, token)
      const messageId = original.id
      const channelId = channel?.id ?? original.channel_id

      // メッセージ本文 + ボタンに編集
      await editWebhookOriginalMessage(application_id, token, ROULETTE_MESSAGE_CONTENT, createRoleRouletteButtons())

      // 各ロール絵文字をリアクションとして追加
      for (const emoji of Object.values(ROLE_EMOJIS)) {
        await addReaction(channelId, messageId, emoji)
      }
    } catch (e) {
      console.error("roleRouletteCommand after error:", e)
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
      // 各ロール絵文字のリアクションユーザーを並列取得
      const [topUsers, jgUsers, midUsers, adcUsers, supUsers, fillUsers] = await Promise.all([
        getReactionUsers(channelId, messageId, ROLE_EMOJIS.TOP),
        getReactionUsers(channelId, messageId, ROLE_EMOJIS.JG),
        getReactionUsers(channelId, messageId, ROLE_EMOJIS.MID),
        getReactionUsers(channelId, messageId, ROLE_EMOJIS.ADC),
        getReactionUsers(channelId, messageId, ROLE_EMOJIS.SUP),
        getReactionUsers(channelId, messageId, ROLE_EMOJIS.FILL),
      ])

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

  after(async () => {
    try {
      // 全リアクション削除
      await deleteAllReactions(channelId, messageId)

      // 各ロール絵文字を再追加
      for (const emoji of Object.values(ROLE_EMOJIS)) {
        await addReaction(channelId, messageId, emoji)
      }
    } catch (e) {
      console.error("handleRoleRouletteReset after error:", e)
    }
  })

  return NextResponse.json({
    type: InteractionResponseType.DeferredMessageUpdate,
  })
}
