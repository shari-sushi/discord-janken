import { NextRequest, NextResponse } from "next/server"
import { verifyKey } from "discord-interactions"
import { echoCommand } from "./application-command/echo"
import { newProtectCommand, handleOpenModalRedTeam, handleOpenModalBlueTeam, handleRegisterRedTeam, handleRegisterBlueTeam, handleCheckRegistered } from "./application-command/newProtect"
import { feedbackCommand, handleSelectFeedbackType, handleSubmitFeedback } from "./application-command/feedback"
import { timerCommand, handleSubmitTimer } from "./application-command/timer"
import { CLIENT_ACTIONS, COMMANDS, DISCORD_INTERACTION_TYPE } from "@/app/util/commands"
import { developersTestCommand, handleTestDevelop1, handleTestDevelop2, handleTestDevelop3, handleTestDevelop4, handleTestDevelop5 } from "./application-command/developers-test"

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get("x-signature-ed25519")
    const timestamp = req.headers.get("x-signature-timestamp")

    if (!signature || !timestamp) {
      console.error("Missing headers")
      return NextResponse.json({ error: "Missing headers" }, { status: 401 })
    }

    const isValid = await verifyKey(rawBody, signature, timestamp, PUBLIC_KEY)
    if (!isValid) {
      console.error("Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const interaction = JSON.parse(rawBody)

    // PING
    if (interaction.type === DISCORD_INTERACTION_TYPE.PING) {
      return NextResponse.json({ type: 1 })
    }

    // discord-botのコマンド
    if (interaction.type === DISCORD_INTERACTION_TYPE.APPLICATION_COMMAND) {
      const { name: commandName, options } = interaction.data
      console.log("command:", commandName)

      switch (commandName) {
        case COMMANDS.ECHO:
          return echoCommand(options)
        case COMMANDS.NEW_PROTECT:
          return newProtectCommand()
        case COMMANDS.TIMER:
          return timerCommand()
        case COMMANDS.FEEDBACK:
          return feedbackCommand()
        case COMMANDS.TEST.ORIGIN:
          return developersTestCommand()
        default:
          return NextResponse.json({
            type: 4,
            data: {
              content: "不明なコマンドです" + commandName,
            },
          })
      }
    }

    // ボタン押された時とか
    if (interaction.type === DISCORD_INTERACTION_TYPE.MESSAGE_COMPONENT) {
      const customId = interaction.data.custom_id
      const [actionId, matchIdParam] = customId.split("?")
      const matchId = new URLSearchParams(matchIdParam || "").get("match_id") || ""
      console.log("action:", actionId)

      switch (actionId) {
        case CLIENT_ACTIONS.OPEN_MODAL_RED_TEAM_REGISTER:
          return handleOpenModalRedTeam(matchId)

        case CLIENT_ACTIONS.OPEN_MODAL_BLUE_TEAM_REGISTER:
          return handleOpenModalBlueTeam(matchId)

        case CLIENT_ACTIONS.SELECT_FEEDBACK_TYPE:
          const selectedType = interaction.data.values?.[0] || ""
          return handleSelectFeedbackType(selectedType)

        case CLIENT_ACTIONS.CHECK_REGISTERED:
          return handleCheckRegistered(matchId)

        // 動作確認テスト用
        case CLIENT_ACTIONS.TEST_DEVELOP_BUTTON.ONE:
          return handleTestDevelop1()
        case CLIENT_ACTIONS.TEST_DEVELOP_BUTTON.TWO:
          return handleTestDevelop2()
        case CLIENT_ACTIONS.TEST_DEVELOP_BUTTON.THREE:
          return handleTestDevelop3()
        case CLIENT_ACTIONS.TEST_DEVELOP_BUTTON.FOUR:
          return handleTestDevelop4()
        case CLIENT_ACTIONS.TEST_DEVELOP_BUTTON.FIVE:
          return handleTestDevelop5()

        default:
          return NextResponse.json({
            type: 4,
            data: {
              content: "不明な操作です" + actionId,
            },
          })
      }
    }

    // モーダルで送信したとき
    if (interaction.type === DISCORD_INTERACTION_TYPE.MODAL_SUBMIT) {
      const customId = interaction.data.custom_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const components = interaction.data.components as any[]

      if (customId.startsWith(CLIENT_ACTIONS.SUBMIT_FEEDBACK)) {
        return handleSubmitFeedback(interaction)
      }

      if (customId === CLIENT_ACTIONS.SUBMIT_TIMER) {
        const timeInput = components[0]?.components[0]?.value || ""
        const message = components[1]?.components[0]?.value || ""
        const channelId = interaction.channel_id || ""
        const guildId = interaction.guild_id || ""
        const userId = interaction.member?.user?.id || ""

        return handleSubmitTimer(timeInput, message, channelId, guildId, userId)
      }

      // match_id を取得（複数の方法で取得を試みる）
      let matchId = ""

      // 最初のコンポーネントのcustom_idから取得を試みる
      const firstCustomId = components[0]?.components[0]?.custom_id || ""
      if (firstCustomId.includes("match_id")) {
        matchId = new URLSearchParams(firstCustomId.split("?")[1] || "").get("match_id") || ""
      }

      if (customId === CLIENT_ACTIONS.REGISTER_RED_TEAM) {
        return handleRegisterRedTeam(matchId, interaction.data)
      }

      if (customId === CLIENT_ACTIONS.REGISTER_BLUE_TEAM) {
        return handleRegisterBlueTeam(matchId, interaction.data)
      }
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
