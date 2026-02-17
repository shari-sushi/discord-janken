import { NextRequest, NextResponse } from "next/server"
import { verifyKey } from "discord-interactions"
import { echoCommand } from "./application-command/echo"
import { newProtectCommand, handleCheckRegistered, handleRegisterTeam, handleOpenModalProtectRole, handleResetRegistered } from "./application-command/newProtect"
import { feedbackCommand, handleSelectFeedbackType, handleSubmitFeedback } from "./application-command/feedback"
import { timerCommand, handleSubmitTimer } from "./application-command/timer"
import { CLIENT_ACTIONS, COMMANDS, DISCORD_INTERACTION_TYPE } from "@/app/util/commands"
import { developersTestCommand, handleTestDevelop1, handleTestDevelop2, handleTestDevelop3, handleTestDevelop4, handleTestDevelop5 } from "./application-command/developers-test"
import { editDiscordMessage } from "@/app/libs/discord/api"
import { getComponentValue } from "@/app/libs/discord/getComponentValue"
import { createProtectComponents } from "./util/protectMessageComponents"

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!

async function disableRegisterButtonsMessage(messageId: string, channelId: string, matchId: string) {
  try {
    await editDiscordMessage(channelId, messageId, "両チーム入力完了し、結果が発表されました", createProtectComponents(matchId, true))
  } catch (e) {
    console.error("Failed to disable register buttons:", e)
  }
}

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
      console.log("MESSAGE_COMPONENT custom_id:", customId)
      const [actionId, matchIdParam] = customId.split("?")
      const matchId = new URLSearchParams(matchIdParam || "").get("match_id") || ""
      console.log("action:", actionId, "matchId:", matchId)

      switch (actionId) {
        case CLIENT_ACTIONS.OPEN_MODAL_RED_TEAM_REGISTER:
          return handleOpenModalProtectRole("red_team", matchId, interaction.message?.id ?? "")

        case CLIENT_ACTIONS.OPEN_MODAL_BLUE_TEAM_REGISTER:
          return handleOpenModalProtectRole("blue_team", matchId, interaction.message?.id ?? "")

        case CLIENT_ACTIONS.CHECK_REGISTERED:
          return handleCheckRegistered(matchId)

        case CLIENT_ACTIONS.RESET_REGISTERED:
          return handleResetRegistered(matchId)

        case CLIENT_ACTIONS.SELECT_FEEDBACK_TYPE:
          const selectedType = interaction.data.values?.[0] || ""
          return handleSelectFeedbackType(selectedType)

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
      const { custom_id: customId, components } = interaction.data
      console.log("MODAL_SUBMIT custom_id:", customId)
      console.log("MODAL_SUBMIT components:", JSON.stringify(components, null, 2))

      if (customId.startsWith(CLIENT_ACTIONS.SUBMIT_FEEDBACK)) {
        return handleSubmitFeedback(interaction)
      }

      if (customId === CLIENT_ACTIONS.SUBMIT_TIMER) {
        const timeInput = getComponentValue("timer_time", interaction.data) ?? ""
        const message = getComponentValue("timer_message", interaction.data) ?? ""
        const channelId = interaction.channel_id || ""
        const guildId = interaction.guild_id || ""
        const userId = interaction.member?.user?.id || ""

        return handleSubmitTimer(timeInput, message, channelId, guildId, userId)
      }

      // match_id を取得（複数の方法で取得を試みる）
      let matchId = ""

      // 最初のコンポーネントのcustom_idから取得を試みる
      const firstCustomId = components[0]?.components[0]?.custom_id || ""
      console.log("First custom_id:", firstCustomId)
      if (firstCustomId.includes("match_id")) {
        matchId = new URLSearchParams(firstCustomId.split("?")[1] || "").get("match_id") || ""
        console.log("Extracted match_id:", matchId)
      }

      const modalParams = new URLSearchParams(customId.split("?")[1] || "")
      const messageId = modalParams.get("message_id") ?? ""
      const channelId = interaction.channel_id || ""
      const userId = interaction.member.user.id ?? ""

      const modalActionId = customId.split("?")[0]
      if (modalActionId === CLIENT_ACTIONS.REGISTER_RED_TEAM) {
        const { response, isBothTeamsRegistered } = await handleRegisterTeam({ matchId, teamSide: "red_team", userId, data: interaction.data })
        if (isBothTeamsRegistered && messageId && channelId) {
          await disableRegisterButtonsMessage(messageId, channelId, matchId)
        }
        return response
      }

      if (modalActionId === CLIENT_ACTIONS.REGISTER_BLUE_TEAM) {
        const { response, isBothTeamsRegistered } = await handleRegisterTeam({ matchId, teamSide: "blue_team", userId, data: interaction.data })
        if (isBothTeamsRegistered && messageId && channelId) {
          await disableRegisterButtonsMessage(messageId, channelId, matchId)
        }
        return response
      }
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
