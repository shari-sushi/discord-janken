import { NextRequest, NextResponse } from "next/server"
import { InteractionType, InteractionResponseType, verifyKey } from "discord-interactions"
import { echoCommand } from "./command/dev/echo"
import { newMatchCommand, handleCheckRegistered, handleRegisterTeam, handleOpenModalProtectRole, handleResetRegistered } from "./command/lol/newMatch"
import { feedbackCommand, handleSelectFeedbackType, handleSubmitFeedback } from "./command/user/feedback"
import { timerCommand, handleSubmitTimer, handleOpenModalTimer } from "./command/user/timer"
import {
  commonMessageCommand,
  handleSubmitNewCommonMessage,
  handleOpenModalEditCommonMessage,
  handleSubmitCommonMessage,
  handleForceEndEditingCommonMessage,
} from "./command/user/commonMessage"
import { handleFightingTeamOrderCommand, handleOpenModalFightingTeamOrder, handleFightingRegisterTeamOrder, handleFightingResetTeamOrder } from "./command/fighting-game/teamOrder"
import { CLIENT_ACTIONS, COMMANDS } from "@/app/_server/util/commands"
import { developersTestCommand } from "./command/dev/developers-test"
import { editDiscordMessage } from "@/app/_server/lib/discord/api"
import { getComponentValue } from "./util/getComponentValue"
import { createProtectComponents } from "./util/protectMessageComponents"

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!

async function disableRegisterButtonsMessage(messageId: string, channelId: string, matchId: string) {
  try {
    await editDiscordMessage(channelId, messageId, "✅ 両チームの入力が完了し、結果が発表されました", createProtectComponents(matchId, true))
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
    if (interaction.type === InteractionType.PING) {
      return NextResponse.json({ type: InteractionResponseType.PONG })
    }

    // discord-botのコマンド
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      const { name: commandName, options } = interaction.data
      console.log("command:", commandName)

      switch (commandName) {
        case COMMANDS.LOL.NEW_MATCH:
          return newMatchCommand()
        case COMMANDS.USER.TIMER:
          return timerCommand()
        case COMMANDS.USER.FEEDBACK:
          return feedbackCommand()
        case COMMANDS.USER.COMMON_MESSAGE:
          return commonMessageCommand()
        case COMMANDS.FIGHTING.TEAM_ORDER:
          return handleFightingTeamOrderCommand(options || [])
        case COMMANDS.DEV.ECHO:
          return echoCommand(options)
        case COMMANDS.DEV.TEST: {
          const testNumber = (options as { name: string; value: number }[] | undefined)?.find((opt) => opt.name === "number")?.value ?? 1
          return developersTestCommand(testNumber)
        }
        default:
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "不明なコマンドです" + commandName,
            },
          })
      }
    }

    if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      const customId = interaction.data.custom_id
      console.log("MESSAGE_COMPONENT custom_id:", customId)
      const [actionId, matchIdParam] = customId.split("?")
      const matchId = new URLSearchParams(matchIdParam || "").get("match_id") || ""
      console.log("action:", actionId, "matchId:", matchId)

      switch (actionId) {
        case CLIENT_ACTIONS.LOL.OPEN_MODAL_RED_TEAM_REGISTER:
          return handleOpenModalProtectRole("red_team", matchId, interaction.message?.id ?? "")

        case CLIENT_ACTIONS.LOL.OPEN_MODAL_BLUE_TEAM_REGISTER:
          return handleOpenModalProtectRole("blue_team", matchId, interaction.message?.id ?? "")

        case CLIENT_ACTIONS.LOL.CHECK_REGISTERED:
          return handleCheckRegistered(matchId)

        case CLIENT_ACTIONS.LOL.RESET_REGISTERED:
          return handleResetRegistered(matchId)

        case CLIENT_ACTIONS.LOL.OPEN_MODAL_TIMER:
          return handleOpenModalTimer(CLIENT_ACTIONS.LOL.SUBMIT_TIMER + `?match_id=${matchId}`)

        case CLIENT_ACTIONS.USER.SELECT_FEEDBACK_TYPE:
          const selectedType = interaction.data.values?.[0] || ""
          return handleSelectFeedbackType(selectedType)

        case CLIENT_ACTIONS.USER.OPEN_MODAL_EDIT_COMMON_MESSAGE:
          return handleOpenModalEditCommonMessage(interaction)

        case CLIENT_ACTIONS.USER.FORCE_END_EDITING_COMMON_MESSAGE:
          return handleForceEndEditingCommonMessage(interaction)

        case CLIENT_ACTIONS.FIGHTING.OPEN_MODAL_TEAM1_ORDER:
          return handleOpenModalFightingTeamOrder(matchId, 1)

        case CLIENT_ACTIONS.FIGHTING.OPEN_MODAL_TEAM2_ORDER:
          return handleOpenModalFightingTeamOrder(matchId, 2)

        case CLIENT_ACTIONS.FIGHTING.RESET_TEAM_ORDER:
          return handleFightingResetTeamOrder(matchId)

        default:
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "不明な操作です" + actionId,
            },
          })
      }
    }

    // モーダルで送信したとき
    if (interaction.type === InteractionType.MODAL_SUBMIT) {
      const { custom_id: customId, components } = interaction.data
      console.log("MODAL_SUBMIT custom_id:", customId)
      console.log("MODAL_SUBMIT components:", JSON.stringify(components, null, 2))

      if (customId.startsWith(CLIENT_ACTIONS.USER.SUBMIT_FEEDBACK)) {
        return handleSubmitFeedback(interaction)
      }

      if (customId === CLIENT_ACTIONS.USER.SUBMIT_NEW_COMMON_MESSAGE) {
        return handleSubmitNewCommonMessage(interaction)
      }

      if (customId.startsWith(CLIENT_ACTIONS.USER.SUBMIT_COMMON_MESSAGE)) {
        return handleSubmitCommonMessage(interaction)
      }

      if (customId === CLIENT_ACTIONS.USER.SUBMIT_TIMER) {
        const timeInput = getComponentValue("timer_time", interaction.data) ?? ""
        const message = getComponentValue("timer_message", interaction.data) ?? ""
        const channelId = interaction.channel_id || ""
        const guildId = interaction.guild_id || ""
        const userId = interaction.member?.user?.id || ""

        return handleSubmitTimer(timeInput, message, channelId, guildId, userId)
      }

      if (customId.startsWith(CLIENT_ACTIONS.LOL.SUBMIT_TIMER)) {
        const timeInput = getComponentValue("timer_time", interaction.data) ?? ""
        const message = getComponentValue("timer_message", interaction.data) ?? ""
        const channelId = interaction.channel_id || ""
        const guildId = interaction.guild_id || ""
        const userId = interaction.member?.user?.id || ""

        const params = new URLSearchParams(customId.split("?")[1] || "")
        const matchId = params.get("match_id") || ""

        return handleSubmitTimer(timeInput, message, channelId, guildId, userId, matchId)
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
      if (modalActionId === CLIENT_ACTIONS.LOL.REGISTER_RED_TEAM) {
        const { response, isBothTeamsRegistered } = await handleRegisterTeam({ matchId, teamSide: "red_team", userId, data: interaction.data })
        if (isBothTeamsRegistered && messageId && channelId) {
          await disableRegisterButtonsMessage(messageId, channelId, matchId)
        }
        return response
      }

      if (modalActionId === CLIENT_ACTIONS.LOL.REGISTER_BLUE_TEAM) {
        const { response, isBothTeamsRegistered } = await handleRegisterTeam({ matchId, teamSide: "blue_team", userId, data: interaction.data })
        if (isBothTeamsRegistered && messageId && channelId) {
          await disableRegisterButtonsMessage(messageId, channelId, matchId)
        }
        return response
      }

      if (modalActionId === CLIENT_ACTIONS.FIGHTING.REGISTER_TEAM1_ORDER) {
        return handleFightingRegisterTeamOrder(matchId, 1, interaction.data)
      }

      if (modalActionId === CLIENT_ACTIONS.FIGHTING.REGISTER_TEAM2_ORDER) {
        return handleFightingRegisterTeamOrder(matchId, 2, interaction.data)
      }
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
