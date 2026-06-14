import { COMMANDS } from "@/app/_server/util/commands"
import { DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, DISCORD_COMMAND_GUILD_ID, ENV } from "@/app/_server/lib/env"
import { type RESTPostAPIApplicationCommandsJSONBody, ApplicationCommandOptionType } from "discord-api-types/v10"
import "dotenv/config"

// npx tsx app/api/discord/command/register.ts でコマンド登録(完全置き換え)できる
// ただし、本番環境のビルド時に実行しているので、通常は手動で実行する必要は無い

const newMatch: RESTPostAPIApplicationCommandsJSONBody = {
  name: COMMANDS.LOL.NEW_MATCH,
  description: "レッドサイド、ブルーサイドそれぞれのプロテクトやロール選択を行い、同時発表できます",
  options: [],
}

const randomSide: RESTPostAPIApplicationCommandsJSONBody = {
  name: COMMANDS.LOL.RANDOM_SIDE,
  description: "ランダムでレッドサイドかブルーサイドかを抽選します",
  options: [],
}

const feedback: RESTPostAPIApplicationCommandsJSONBody = {
  name: COMMANDS.USER.FEEDBACK,
  description: "フィードバックを送信します",
  options: [],
}

const timer: RESTPostAPIApplicationCommandsJSONBody = {
  name: COMMANDS.USER.TIMER,
  description: "指定時刻にメッセージを送信するタイマーを設定します",
  options: [],
}

const commonMessage: RESTPostAPIApplicationCommandsJSONBody = {
  name: COMMANDS.USER.COMMON_MESSAGE,
  description: "みんなで編集できる共有メッセージを投稿します",
  options: [],
}

const mentionByReaction: RESTPostAPIApplicationCommandsJSONBody = {
  name: COMMANDS.USER.MENTION_REACTORS,
  description: "特定のメッセージに指定のリアクションをつけた人にメンションでメッセージを送れます",
  options: [
    {
      name: "message_link",
      description: "メッセージのリンク（右クリック→メッセージのリンクをコピー）",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
}

const teamScheduleLogin: RESTPostAPIApplicationCommandsJSONBody = {
  name: COMMANDS.TEAM_SCHEDULE.LOGIN,
  description: "チーム活動 スケジュール調整ページのログイン用リンクを発行します（本人にだけ表示）",
  options: [],
}

const echo: RESTPostAPIApplicationCommandsJSONBody = {
  name: COMMANDS.DEV.ECHO,
  description: "入力したテキストをbotがチャットに送信",
  options: [
    {
      name: "text",
      description: "送信するテキスト",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
}

const test: RESTPostAPIApplicationCommandsJSONBody = {
  name: COMMANDS.DEV.TEST,
  description: "実装の動作確認コマンド",
  options: [
    {
      name: "test_number",
      description: "{test_num}::[url?{url}|num?{num}]",
      type: ApplicationCommandOptionType.Integer,
      required: true,
    },
    {
      name: "url_or_num",
      description: "[url:{url} | num:{num}]",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
}

const fightingTeamOrder: RESTPostAPIApplicationCommandsJSONBody = {
  name: COMMANDS.FIGHTING.TEAM_ORDER,
  description: "格ゲーチーム戦の出場順を両チーム同時に発表します",
  options: [
    {
      name: "format",
      description: "チーム戦の形式",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: "2v2", value: "2v2" },
        { name: "3v3", value: "3v3" },
        { name: "5v5", value: "5v5" },
      ],
    },
    {
      name: "team1_name",
      description: "チーム1の名前",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: "team2_name",
      description: "チーム2の名前",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
}

const roleRoulette: RESTPostAPIApplicationCommandsJSONBody = {
  name: COMMANDS.LOL.ROLE_ROULETTE,
  description: "LoLのロール抽選を行います",
  options: [],
}

// コマンド追加/削除時はここを変更する
const ALL_COMMANDS = {
  lol: { newMatch, randomSide, roleRoulette },
  user: { feedback, timer, commonMessage, mentionByReaction },
  fighting: { fightingTeamOrder },
  teamSchedule: { teamScheduleLogin },
  dev: { echo, test },
}

const commands: RESTPostAPIApplicationCommandsJSONBody[] = Object.values(ALL_COMMANDS).flatMap((group) => Object.values(group))

// 開発環境ではコマンド登録をスキップ
if (ENV !== "production" && ENV !== "preview") {
  console.log("Skipping command registration in development environment:", ENV)
  process.exit(0)
}

const isGuildCommand = !!DISCORD_COMMAND_GUILD_ID

const baseUrl = `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}`
const url = isGuildCommand ? `${baseUrl}/guilds/${DISCORD_COMMAND_GUILD_ID}/commands` : `${baseUrl}/commands`

console.log(`Registering commands as ${isGuildCommand ? "guild commands (即時反映)" : "global commands (最大1時間)"}`)

if (isGuildCommand) {
  ;(async () => {
    // 既存のguild commandsを取得し、そこに無いもののみpostする。
    // 登録済みだがこのファイルのリストに無いものは「残しておく」。他ブランチで登録した可能性が高いため。

    let existingCommands: { name: string; id: string }[] = []
    try {
      const getRes = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        },
      })

      if (!getRes.ok) {
        const errorData = await getRes.json()
        console.error("Failed to get existing commands:", JSON.stringify(errorData, null, 2))
        process.exit(1)
      }

      existingCommands = await getRes.json()
      console.log(`Found ${existingCommands.length} existing guild commands`)
    } catch (err) {
      console.error("Error fetching existing commands:", err)
      process.exit(1)
    }

    // 既存コマンドの名前リストを作成
    const existingCommandNames = new Set(existingCommands.map((cmd) => cmd.name))

    // 新しいコマンドのうち、既存に無いもののみPOST
    let registeredCount = 0
    let skippedCount = 0

    for (const command of commands) {
      // Rate limit対策: 2ms で5つpostしたらrate limitsに引っかかった経緯有り(再現性2/2)
      if (registeredCount > 0 && registeredCount % 4 == 0) {
        const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
        await sleep(4000)
      }

      if (existingCommandNames.has(command.name)) {
        console.log(`⊖ Already exists: ${command.name}`)
        skippedCount++
        continue
      }

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(command),
        })

        const data = await res.json()
        if (!res.ok) {
          console.error(`Failed to register command "${command.name}":`, JSON.stringify(data, null, 2))
          process.exit(1)
        }
        console.log(`✓ Registered: ${command.name}`)
        registeredCount++
      } catch (err) {
        console.error(`Error registering command "${command.name}":`, err)
        process.exit(1)
      }
    }

    console.log(`\nSummary:`)
    console.log(`  Registered: ${registeredCount}`)
    console.log(`  Skipped (already exists): ${skippedCount}`)
    console.log(`  Kept (not in this list): ${existingCommands.length - skippedCount}`)
  })()
} else {
  fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  })
    .then(async (res) => {
      const data = await res.json()
      if (!res.ok) {
        console.error("Failed to register commands:", JSON.stringify(data, null, 2))
        process.exit(1)
      }
      console.log("Commands registered successfully:", data)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
