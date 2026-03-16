import { APIEmbed } from "discord-api-types/v10"

type ReminderEmbedInput = {
  message?: string
  createdBy?: string
  matchStatusContent?: string
}

export const createReminderEmbeds = (input: ReminderEmbedInput, suffixEmbeds: APIEmbed[], color = 3447003): APIEmbed[] => {
  // 5. メッセージを構築
  const timerEmbed: APIEmbed = {
    title: "⏰ タイマー通知",
    color: color,
    description: "",
  }

  if (input.message) {
    timerEmbed.description += `メッセージ：${input.message}\n`
  } else {
    timerEmbed.description += `メッセージ：無し\n`
  }

  if (input.createdBy && input.createdBy.trim() !== "") {
    console.log("input.createdBy:", input.createdBy) // @unknown-role と出ることがあるので出力しておく。
    timerEmbed.author = {
      name: `<@${input.createdBy}>`,
    }
  }

  // 試合の現在状況を追加
  if (input.matchStatusContent) {
    timerEmbed.description += `\n${input.matchStatusContent}`
  }

  return [timerEmbed, ...(suffixEmbeds ?? [])]
}
