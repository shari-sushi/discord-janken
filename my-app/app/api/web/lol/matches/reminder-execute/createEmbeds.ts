import { DiscordEmbed } from "@/app/_server/lib/discord/types"

type ReminderEmbedInput = {
  message?: string
  createdBy?: string
  matchStatusContent?: string
}

export const createReminderEmbeds = (input: ReminderEmbedInput, suffixEmbeds: DiscordEmbed[], color = 3447003): DiscordEmbed[] => {
  // 5. メッセージを構築
  const timerEmbed: DiscordEmbed = {
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
