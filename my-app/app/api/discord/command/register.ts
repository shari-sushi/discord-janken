import { COMMANDS } from "@/app/_server/util/commands"
import { ApplicationCommandOptionType } from "@/app/_server/lib/discord/types"
import { DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID } from "@/app/_server/lib/env"
import "dotenv/config"

// npx tsx app/api/discord/command/register.ts でコマンド登録(完全置き換え)できる
// ただし、本番環境のビルド時に実行しているので、通常は手動で実行する必要は無い

type DiscordBotCommand = {
  name: string
  description: string
  options?: { name: string; description: string; type: ApplicationCommandOptionType; required: boolean }[]
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
      type: ApplicationCommandOptionType.STRING,
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
      type: ApplicationCommandOptionType.INTEGER,
      required: true,
    },
  ],
}

const fightingTeamOrder: DiscordBotCommand = {
  name: COMMANDS.FIGHTING.TEAM_ORDER,
  description: "格ゲーチーム戦の出場順を両チーム同時に発表します",
  options: [
    {
      name: "format",
      description: "チーム戦の形式",
      type: ApplicationCommandOptionType.STRING,
      required: true,
      // @ts-expect-error - choices is valid but not in base type
      choices: [
        { name: "2v2", value: "2v2" },
        { name: "3v3", value: "3v3" },
        { name: "5v5", value: "5v5" },
      ],
    },
    {
      name: "team1_name",
      description: "チーム1の名前",
      type: ApplicationCommandOptionType.STRING,
      required: false,
    },
    {
      name: "team2_name",
      description: "チーム2の名前",
      type: ApplicationCommandOptionType.STRING,
      required: false,
    },
  ],
}

const commands: DiscordBotCommand[] = [newMatch, feedback, timer, commonMessage, fightingTeamOrder, echo, test]

fetch(`https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`, {
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
