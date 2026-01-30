import "dotenv/config"

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID!
const COMMAND_PREF = "same-say-"

type DiscordBotCommand = {
  name: string
  description: string
  options?: { name: string; description: string; type: number; required: boolean }[]
}

const EchoCommands: DiscordBotCommand = {
  name: COMMAND_PREF + "echo",
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

const newProtect: DiscordBotCommand = {
  name: COMMAND_PREF + "new-protect",
  description: "赤チーム・青チーム・確認ボタンを表示します",
  options: [],
}

const SubmitCommand: DiscordBotCommand = {
  name: COMMAND_PREF + "submit",
  description: "同時発言に参加",
  options: [
    {
      name: "message",
      description: "発言内容",
      type: 3,
      required: true,
    },
  ],
}

const commands: DiscordBotCommand[] = [SubmitCommand, EchoCommands, newProtect]

fetch(`https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`, {
  // POSTにすると新規登録のみで古いのは変更されない
  method: "PUT", // POST → PUT に変更
  headers: {
    Authorization: `Bot ${DISCORD_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands), // 配列で送信
})
  .then((res) => res.json())
  .then(console.log)
  .catch(console.error)
