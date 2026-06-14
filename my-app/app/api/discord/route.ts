import { NextRequest, NextResponse } from "next/server"
import { verifyKey } from "discord-interactions"
import { echoCommand } from "./command/dev/echo"
import { newMatchCommand, handleCheckRegistered, handleRegisterTeam, handleOpenModalProtectRole, handleResetRegistered } from "./command/lol/newMatch"
import { randomSideCommand } from "./command/lol/randomSide"
import { feedbackCommand, handleSelectFeedbackType, handleSubmitFeedback } from "./command/user/feedback"
import { timerCommand, handleSubmitTimer, handleOpenModalTimer } from "./command/user/timer"
import { commonMessageCommand, handleSubmitNewCommonMessage, handleOpenModalEditCommonMessage, handleSubmitCommonMessage, handleForceEndEditingCommonMessage } from "./command/user/commonMessage"
import { mentionReactorsCommand } from "./command/user/mentionReactors"
import { teamScheduleLoginCommand } from "./command/team-schedule/login"
import { handleFightingTeamOrderCommand, handleOpenModalFightingTeamOrder, handleFightingRegisterTeamOrder, handleFightingResetTeamOrder } from "./command/fighting-game/teamOrder"
import { roleRouletteCommand, handleRoleRouletteStart, handleRoleRouletteReset } from "./command/lol/roleRoulette"
import { CLIENT_ACTIONS, COMMANDS } from "@/app/_server/util/commands"
import { developersTestCommand } from "./command/dev/developers-test"
import { editDiscordMessage } from "@/app/_server/lib/discord/api"
import { getValue } from "./util/getComponentValue"
import { createProtectComponents } from "./util/createProtectMessageComponents"
import { extractModalSubmitInteractionData } from "./util/extractModalSubmitInteractionData"
import { extractMatchId, extractMessageId } from "./util/extractCustomIdParam"
import { DISCORD_PUBLIC_KEY } from "@/app/_server/lib/env"
import { FeedBackType } from "@/app/_domains/user/feedback/types"
import {
  APIInteraction,
  InteractionResponseType,
  InteractionType,
  APIChatInputApplicationCommandInteraction,
  APIUserApplicationCommandInteraction,
  APIMessageApplicationCommandInteraction,
  APIApplicationCommandInteraction,
  ApplicationCommandType,
} from "discord-api-types/v10"

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

    const isValid = await verifyKey(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY)
    if (!isValid) {
      console.error("Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // const interaction = JSON.parse(rawBody) as DiscordInteractionObject
    const interaction = JSON.parse(rawBody) as APIInteraction

    // PING
    if (interaction.type === InteractionType.Ping) {
      return NextResponse.json({ type: InteractionType.Ping })
    }

    // discord-botのコマンド
    if (interaction.type === InteractionType.ApplicationCommand) {
      // チャット入力コマンド（スラッシュコマンド）に絞り込み
      if (!isChatInputCommand(interaction)) {
        console.error("サポートされていないコマンドタイプです")
        return NextResponse.json({ error: "Unsupported command type" }, { status: 400 })
      }

      const { name: commandName, options } = interaction.data
      console.log("command:", commandName)

      switch (commandName) {
        case COMMANDS.LOL.NEW_MATCH:
          return newMatchCommand()
        case COMMANDS.LOL.RANDOM_SIDE:
          return randomSideCommand()
        case COMMANDS.LOL.ROLE_ROULETTE:
          return roleRouletteCommand(interaction)
        case COMMANDS.USER.TIMER:
          return timerCommand()
        case COMMANDS.USER.FEEDBACK:
          return feedbackCommand()
        case COMMANDS.USER.COMMON_MESSAGE:
          return commonMessageCommand()
        case COMMANDS.USER.MENTION_REACTORS:
          return mentionReactorsCommand(interaction)
        case COMMANDS.FIGHTING.TEAM_ORDER:
          return handleFightingTeamOrderCommand(options)
        case COMMANDS.TEAM_SCHEDULE.LOGIN:
          return teamScheduleLoginCommand(interaction)
        case COMMANDS.DEV.ECHO:
          return echoCommand(options)
        case COMMANDS.DEV.TEST: {
          return developersTestCommand(options)
        }
        default:
          return NextResponse.json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: "不明なコマンドです" + commandName,
            },
          })
      }
    }

    if (interaction.type === InteractionType.MessageComponent) {
      if (!interaction.data?.custom_id) {
        return NextResponse.json({ error: "Missing custom_id" }, { status: 400 })
      }
      const customId = interaction.data.custom_id
      console.log("MESSAGE_COMPONENT custom_id:", customId)
      const [actionId] = customId.split("?")
      const matchId = extractMatchId(customId) || ""
      console.log("action:", actionId, "matchId:", matchId)

      // MENTION_REACTORSのセレクトメニュー処理（custom_idに":"が含まれるため特別処理）
      // TODO: mentionReactors機能は未実装のためコメントアウト
      // if (customId.startsWith(CLIENT_ACTIONS.USER.MENTION_REACTORS.SELECT_REACTION)) {
      //   return handleSelectReaction(interaction)
      // }

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
          if (interaction.data && "values" in interaction.data && interaction.data.values?.[0]) {
            return handleSelectFeedbackType(interaction.data.values[0] as FeedBackType)
          }
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
        case CLIENT_ACTIONS.LOL.ROLE_ROULETTE_START:
          return handleRoleRouletteStart(interaction)
        case CLIENT_ACTIONS.LOL.ROLE_ROULETTE_RESET:
          return handleRoleRouletteReset(interaction)

        default:
          return NextResponse.json({
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content: "不明な操作です" + actionId,
            },
          })
      }
    }

    // モーダルで送信したとき
    if (interaction.type === InteractionType.ModalSubmit) {
      if (!interaction.data?.custom_id) {
        return NextResponse.json({ error: "Missing custom_id in modal submit" }, { status: 400 })
      }
      if (!interaction.data?.components) {
        return NextResponse.json({ error: "Missing components in modal submit" }, { status: 400 })
      }
      const { custom_id: customId, components } = interaction.data
      console.log("MODAL_SUBMIT custom_id:", customId)
      console.log("MODAL_SUBMIT components:", JSON.stringify(components, null, 2))

      // TODO: mentionReactors機能は未実装のためコメントアウト
      // if (customId.startsWith(CLIENT_ACTIONS.USER.MENTION_REACTORS.MODAL)) {
      //   return handleMentionReactors(interaction)
      // }

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
        const message = getValue("timer_message", interaction.data)
        const timeInput = getValue("timer_time", interaction.data) || ""
        if (!timeInput) {
          console.error("timeInputが空です") // modalでrequired指定してるので通常あり得ない
        }

        const { channelId, guildId, userId } = extractModalSubmitInteractionData(interaction)
        if (!channelId || !guildId || !userId) {
          // 通常あり得ない
          console.error("以下は全て必要です。guild_id:", guildId, ", channel_id:", channelId, ", user_id", userId)
          return NextResponse.json({ error: "不明なエラーです。再度お試し下さい。" }, { status: 500 })
        }

        return handleSubmitTimer({ timeInput, message, channelId, guildId, userId })
      }

      if (customId.startsWith(CLIENT_ACTIONS.LOL.SUBMIT_TIMER)) {
        const timeInput = getValue("timer_time", interaction.data) ?? ""
        const message = getValue("timer_message", interaction.data) ?? ""
        const channelId = interaction.channel_id || ""
        const guildId = interaction.guild_id || ""
        const userId = interaction.member?.user?.id || ""
        const matchId = extractMatchId(customId) || ""

        return handleSubmitTimer({ timeInput, message, channelId, guildId, userId, matchId })
      }

      // match_id を取得（最初のコンポーネントのcustom_idから取得を試みる）
      const firstComponent = components?.[0]
      let firstCustomId = ""
      if (firstComponent && "components" in firstComponent && firstComponent.components?.[0]) {
        firstCustomId = firstComponent.components[0].custom_id || ""
      } else if (firstComponent && "component" in firstComponent && firstComponent.component) {
        firstCustomId = firstComponent.component.custom_id || ""
      }
      console.log("First custom_id:", firstCustomId)
      const matchId = extractMatchId(firstCustomId) || ""
      console.log("Extracted match_id:", matchId)
      const messageId = extractMessageId(customId) || ""

      const channelId = interaction.channel_id || ""
      const userId = interaction.member?.user?.id ?? ""

      const modalActionId = customId.split("?")[0]
      if (modalActionId === CLIENT_ACTIONS.LOL.REGISTER_RED_TEAM) {
        if (!interaction.data) {
          return NextResponse.json({ error: "Missing interaction data" }, { status: 400 })
        }

        const { response, isBothTeamsRegistered } = await handleRegisterTeam({ matchId, teamSide: "red_team", userId, data: interaction.data })
        if (isBothTeamsRegistered && messageId && channelId) {
          await disableRegisterButtonsMessage(messageId, channelId, matchId)
        }

        return response
      }

      if (modalActionId === CLIENT_ACTIONS.LOL.REGISTER_BLUE_TEAM) {
        if (!interaction.data) {
          return NextResponse.json({ error: "Missing interaction data" }, { status: 400 })
        }

        const { response, isBothTeamsRegistered } = await handleRegisterTeam({ matchId, teamSide: "blue_team", userId, data: interaction.data })
        if (isBothTeamsRegistered && messageId && channelId) {
          await disableRegisterButtonsMessage(messageId, channelId, matchId)
        }

        return response
      }

      if (modalActionId === CLIENT_ACTIONS.FIGHTING.REGISTER_TEAM1_ORDER) {
        if (!interaction.data) {
          return NextResponse.json({ error: "Missing interaction data" }, { status: 400 })
        }

        return handleFightingRegisterTeamOrder(matchId, 1, interaction.data)
      }

      if (modalActionId === CLIENT_ACTIONS.FIGHTING.REGISTER_TEAM2_ORDER) {
        if (!interaction.data) {
          return NextResponse.json({ error: "Missing interaction data" }, { status: 400 })
        }

        return handleFightingRegisterTeamOrder(matchId, 2, interaction.data)
      }
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

const isChatInputCommand = (interaction: APIApplicationCommandInteraction): interaction is APIChatInputApplicationCommandInteraction => {
  return interaction.data?.type === ApplicationCommandType.ChatInput
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const isUserCommand = (interaction: APIApplicationCommandInteraction): interaction is APIUserApplicationCommandInteraction => {
  return interaction.data?.type === ApplicationCommandType.User
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const isMessageCommand = (interaction: APIApplicationCommandInteraction): interaction is APIMessageApplicationCommandInteraction => {
  return interaction.data?.type === ApplicationCommandType.Message
}
