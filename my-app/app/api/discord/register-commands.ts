import { COMMANDS } from "@/app/util/commands"
import "dotenv/config"

// npx tsx app/api/discord/register-commands.ts でコマンド登録(完全置き換え)できる
// ただし、本番環境でビルド時に実行させているので、通常は手動で実行する必要は無い

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID!

type DiscordBotCommand = {
  name: string
  description: string
  options?: { name: string; description: string; type: number; required: boolean }[]
}

const newMatch: DiscordBotCommand = {
  name: COMMANDS.LOL.NEW_MATCH,
  description: "レッドサイド、ブルーサイドそれぞれのプロテクトやロール選択を行い、同時発表できます",
  options: [],
}

const feedback: DiscordBotCommand = {
  name: COMMANDS.USER.FEEDBACK,
  description: "フィードバックを送信します",
  options: [],
}

const timer: DiscordBotCommand = {
  name: COMMANDS.USER.TIMER,
  description: "指定時刻にメッセージを送信するタイマーを設定します",
  options: [],
}

const commonMessage: DiscordBotCommand = {
  name: COMMANDS.USER.COMMON_MESSAGE,
  description: "みんなで編集できる共有メッセージを投稿します",
  options: [],
}

const echo: DiscordBotCommand = {
  name: COMMANDS.DEV.ECHO,
  description: "入力したテキストをbotがチャットに送信",
  options: [
    {
      name: "text",
      description: "送信するテキスト",
      type: 3,
      required: true,
    },
  ],
}

const test: DiscordBotCommand = {
  name: COMMANDS.DEV.TEST,
  description: "実装の動作確認コマンド",
  options: [
    {
      name: "number",
      description: "テスト番号 (1-5)を入力する",
      type: 4, // INTEGER
      required: true,
    },
  ],
}

const commands: DiscordBotCommand[] = [newMatch, feedback, timer, commonMessage, echo, test]

fetch(`https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`, {
  // POSTにすると新規登録のみで古いのは変更されない
  method: "PUT", // POST → PUT に変更
  headers: {
    Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands), // 配列で送信
})
  .then((res) => res.json())
  .then(console.log)
  .catch(console.error)
