import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { NextResponse } from "next/server"
import { qstashPublishJSON } from "@/app/_server/lib/qstash/qstash"
import { parseReminderAt } from "@/app/domains/lol/_server/validators"
import { APP_URL } from "@/app/_server/lib/env"
import { ComponentType, InteractionResponseType, MessageFlags, TextInputStyle } from "discord-api-types/v10"

// コマンド初期表示（モーダル表示）
export const timerCommand = (): NextResponse => {
  return handleOpenModalTimer(CLIENT_ACTIONS.USER.SUBMIT_TIMER)
}

export const handleOpenModalTimer = (customId: string) => {
  return NextResponse.json({
    type: InteractionResponseType.Modal,
    data: {
      custom_id: customId,
      title: "タイマー設定",
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "timer_time",
              label: "時刻（HH:MM または M分後）",
              style: TextInputStyle.Short,
              required: true,
              placeholder: "例: 14:30 または 10分後",
            },
          ],
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextInput,
              custom_id: "timer_message",
              label: "通知メッセージ",
              style: TextInputStyle.Paragraph,
              required: false,
              placeholder: "例: 試合開始時刻です",
            },
          ],
        },
      ],
    },
  })
}

type HandleSubmitTimerArgs = {
  guildId: string
  channelId: string
  userId: string
  timeInput: string
  message?: string
  matchId?: string
}

// モーダル送信処理
export const handleSubmitTimer = async ({ guildId, channelId, timeInput, userId, matchId, message }: HandleSubmitTimerArgs): Promise<NextResponse> => {
  try {
    const targetDate = parseReminderAt(timeInput)

    if (!targetDate) {
      return NextResponse.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "⚠️ 時刻の形式が正しくありません。\n正しい形式: `HH:MM` または `M分後`",
          flags: MessageFlags.Ephemeral,
        },
      })
    }

    // メッセージが未入力の場合のデフォルト値
    const notificationMessage = message || "タイマーが作動しました\nメッセージは設定されていません"

    // QStashにスケジュール登録
    // matchId がある場合は LoL 試合用エンドポイントを使用
    const callbackUrl = matchId ? `${APP_URL}/api/web/lol/matches/reminder-execute` : `${APP_URL}/api/web/timer/execute`

    const payload = matchId ? { channelId, message: notificationMessage, guildId, createdBy: userId, matchId } : { channelId, message: notificationMessage, guildId, createdBy: userId }

    await qstashPublishJSON(callbackUrl, payload, Math.floor(targetDate.getTime() / 1000))

    const timeString = timeInput

    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `⏰ タイマーを設定しました\n時刻: ${timeString}\nメッセージ: ${notificationMessage}`,
        flags: MessageFlags.Ephemeral,
      },
    })
  } catch (error) {
    console.error("Timer setup error:", error)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "❌ タイマーの設定に失敗しました",
        flags: MessageFlags.Ephemeral,
      },
    })
  }
}
