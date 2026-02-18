import { CLIENT_ACTIONS } from "@/app/util/commands"
import { NextResponse } from "next/server"
import { Client } from "@upstash/qstash"

const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
})

// 時刻パース関数（HH:MM または M分後）
const parseTime = (input: string): Date | null => {
  const now = new Date()

  // "M分後" 形式のチェック
  const minutesMatch = input.match(/^(\d+)分後$/)
  if (minutesMatch) {
    const minutes = parseInt(minutesMatch[1], 10)
    return new Date(now.getTime() + minutes * 60 * 1000)
  }

  // "HH:MM" 形式のチェック
  const timeMatch = input.match(/^(\d{1,2}):(\d{2})$/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null
    }

    // JSTで指定された時刻を設定
    const targetDate = new Date()
    targetDate.setHours(hours, minutes, 0, 0)

    // もし指定時刻が過去なら、翌日に設定
    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 1)
    }

    return targetDate
  }

  return null
}

// コマンド初期表示（モーダル表示）
export const timerCommand = () => {
  return NextResponse.json({
    type: 9,
    data: {
      custom_id: CLIENT_ACTIONS.USER.SUBMIT_TIMER,
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
    const targetDate = parseTime(timeInput)

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

    await qstashClient.publishJSON({
      url: callbackUrl,
      body: {
        channelId,
        message: notificationMessage,
        guildId,
        createdBy: userId,
      },
      notBefore: Math.floor(targetDate.getTime() / 1000), // Unix timestamp (秒)
    })

    const timeString = timeInput.includes("分後") ? timeInput : `${targetDate.getHours()}:${targetDate.getMinutes().toString().padStart(2, "0")}`

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
