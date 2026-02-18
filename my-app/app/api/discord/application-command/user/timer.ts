import { CLIENT_ACTIONS } from "@/app/util/commands"
import { NextResponse } from "next/server"
import { qstashPublishJSON } from "@/app/libs/qstash/qstash"
import { parseReminderAt } from "@/app/api/web/lol/_validators/discordValidators"

// コマンド初期表示（モーダル表示）
export const timerCommand = () => {
  return handleOpenModalTimer(CLIENT_ACTIONS.USER.SUBMIT_TIMER)
}

export const handleOpenModalTimer = (customId: string) => {
  return NextResponse.json({
    type: 9,
    data: {
      custom_id: customId,
      title: "タイマー設定",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "timer_time",
              label: "時刻（HH:MM または M分後）",
              style: 1,
              required: true,
              placeholder: "例: 14:30 または 10分後",
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "timer_message",
              label: "通知メッセージ",
              style: 2,
              required: false,
              placeholder: "例: 試合開始時刻です",
            },
          ],
        },
      ],
    },
  })
}

// モーダル送信処理
export const handleSubmitTimer = async (timeInput: string, message: string, channelId: string, guildId: string, userId: string) => {
  try {
    const targetDate = parseReminderAt(timeInput)

    if (!targetDate) {
      return NextResponse.json({
        type: 4,
        data: {
          content: "⚠️ 時刻の形式が正しくありません。\n正しい形式: `HH:MM` または `M分後`",
          flags: 64, // Ephemeral
        },
      })
    }

    // メッセージが未入力の場合のデフォルト値
    const notificationMessage = message || "タイマーが作動しました"

    // QStashにスケジュール登録
    const callbackUrl = `${process.env.APP_URL}/api/web/timer/execute`

    await qstashPublishJSON(
      callbackUrl,
      { channelId, message: notificationMessage, guildId, createdBy: userId },
      Math.floor(targetDate.getTime() / 1000),
    )

    const timeString = timeInput

    return NextResponse.json({
      type: 4,
      data: {
        content: `⏰ タイマーを設定しました\n時刻: ${timeString}\nメッセージ: ${notificationMessage}`,
        flags: 64, // Ephemeral
      },
    })
  } catch (error) {
    console.error("Timer setup error:", error)
    return NextResponse.json({
      type: 4,
      data: {
        content: "❌ タイマーの設定に失敗しました",
        flags: 64,
      },
    })
  }
}
