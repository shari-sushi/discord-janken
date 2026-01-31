import { COMMANDS } from "@/app/util/commands"
import "dotenv/config"

// npx tsx app/api/discord/register-commands.ts でコマンド登録(完全置き換え)できる
// ただし、本番環境でビルド時に実行させているので、通常は手動で実行する必要は無い

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID!

type DiscordBotCommand = {
  name: string
  description: string
  options?: { name: string; description: string; type: number; required: boolean }[]
}

const EchoCommands: DiscordBotCommand = {
  name: COMMANDS.ECHO,
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
  name: COMMANDS.NEW_PROTECT,
  description: "赤チーム・青チーム・確認ボタンを表示します",
  options: [],
}

const commands: DiscordBotCommand[] = [EchoCommands, newProtect]

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
