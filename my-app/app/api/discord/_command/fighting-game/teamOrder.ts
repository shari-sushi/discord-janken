import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { newId } from "@/app/_server/util/newId"
import { NextResponse } from "next/server"
import { redisSet, redisGet } from "@/app/_server/lib/redis/redis"
import {
  APIActionRowComponent,
  APIComponentInMessageActionRow,
  APIModalInteractionResponseCallbackComponent,
  APIModalInteractionResponseCallbackData,
  APIModalSubmission,
  ButtonStyle,
  ComponentType,
  InteractionResponseType,
  MessageFlags,
  RESTAPIInteractionCallbackResourceObject,
  TextInputStyle,
} from "discord-api-types/v10"
import { APIApplicationCommandInteractionDataOption, APIApplicationCommandInteractionDataBasicOption, InteractionType } from "discord-api-types/v10"
import { TeamFormat, TeamOrderData, FightingTeamOrderMeta, TeamData, OrderedTeamData } from "@/app/domains/fighting/types"
import { getMetaKey, getTeamKey } from "@/app/domains/fighting/_server/redisKeys"
import { isOrderedTeamData } from "@/app/domains/fighting/_server/validators"
import { TEAM_FORMAT_POSITIONS, getPositionLabel } from "@/app/domains/fighting/_server/constants"
import { getValue } from "../../_util/getComponentValue"
import { customId } from "../../_util/customId"

// 型ガード: valueプロパティを持つ基本オプションかどうか
const isBasicOption = (
  opt: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommand>,
): opt is APIApplicationCommandInteractionDataBasicOption<InteractionType.ApplicationCommand> => {
  return "value" in opt
}

// フォーマットに応じた入力ボタンコンポーネントを生成
const createTeamOrderButtons = (matchId: string, disabled: boolean = false): APIActionRowComponent<APIComponentInMessageActionRow>[] => {
  return [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          style: ButtonStyle.Primary,
          label: "チーム1 出場順を入力",
          custom_id: customId(CLIENT_ACTIONS.FIGHTING.OPEN_MODAL_TEAM1_ORDER).matchId(matchId),
          disabled,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Primary,
          label: "チーム2 出場順を入力",
          custom_id: customId(CLIENT_ACTIONS.FIGHTING.OPEN_MODAL_TEAM2_ORDER).matchId(matchId),
          disabled,
        },
      ],
    },
  ]
}

// リセットボタンコンポーネントを生成
const createResetButton = (matchId: string): APIActionRowComponent<APIComponentInMessageActionRow> => {
  return {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Danger,
        label: "リセット",
        custom_id: customId(CLIENT_ACTIONS.FIGHTING.RESET_TEAM_ORDER).matchId(matchId),
      },
    ],
  }
}

// 初期メッセージを生成（両チーム未登録）
const createInitialMessage = ({ meta, teams }: { meta: FightingTeamOrderMeta; teams: { team1?: TeamData; team2?: TeamData } }): string => {
  const team1Name = teams.team1?.teamName || "チーム1"
  const team2Name = teams.team2?.teamName || "チーム2"
  const mess =
    `**【格ゲーチーム戦 出場順登録】**\n` +
    `形式: ${meta.format}\n` +
    `🔵 ${team1Name}: ⏳ 未登録\n` +
    `🔴 ${team2Name}: ⏳ 未登録\n` +
    `\n` +
    `各チームは下のボタンから出場順を入力してください。\n` +
    `両チーム登録完了後、同時に発表されます。`

  return mess
}

// 片方のみ登録済みメッセージを生成
const createPartialMessage = ({ meta, teams }: { meta: FightingTeamOrderMeta; teams: { team1?: TeamData; team2?: TeamData } }): string => {
  const team1Name = teams.team1?.teamName || "チーム1"
  const team2Name = teams.team2?.teamName || "チーム2"
  const team1Status = teams.team1?.order ? "✅ 登録済み" : "⏳ 未登録"
  const team2Status = teams.team2?.order ? "✅ 登録済み" : "⏳ 未登録"
  const mess =
    `**【格ゲーチーム戦 出場順登録】**\n` + // formatterに改行を消させないためのコメント
    `形式: ${meta.format}\n` +
    `🔵 ${team1Name}: ${team1Status}\n` +
    `🔴 ${team2Name}: ${team2Status}\n`

  return mess
}

// 出場順を表示形式に整形
const formatTeamOrder = (order: TeamOrderData, format: TeamFormat): string => {
  const positions = TEAM_FORMAT_POSITIONS[format]

  return positions
    .map((position, index) => {
      const value = order[position]
      if (!value) return null

      const prefix = index === positions.length - 1 ? "└" : "├"
      return `${prefix} ${getPositionLabel(position)}: ${value}`
    })
    .filter((line): line is string => line !== null)
    .join("\n")
}

// 両チーム登録完了メッセージを生成
const createCompletionMessage = ({ meta, teams }: { meta: FightingTeamOrderMeta; teams: { team1: OrderedTeamData; team2: OrderedTeamData } }): string => {
  const mess =
    `**【格ゲーチーム戦 出場順発表】**\n` +
    `形式: ${meta.format}\n` +
    `\n` +
    `🔵 ${teams.team1.teamName}\n` +
    `${formatTeamOrder(teams.team1.order, meta.format)}\n` +
    `\n` +
    `🔴 ${teams.team2.teamName}\n` +
    `${formatTeamOrder(teams.team2.order, meta.format)}`
  return mess
}

// コマンド初期表示
export const handleFightingTeamOrderCommand = async (options?: APIApplicationCommandInteractionDataOption<InteractionType.ApplicationCommand>[]): Promise<NextResponse> => {
  if (!options) {
    console.error("optionが必要です")
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "エラー: フォーマットを選択してください", flags: MessageFlags.Ephemeral },
    })
  }

  const formatOption = options.find((opt) => opt.name === "format" && isBasicOption(opt))
  const format = formatOption && isBasicOption(formatOption) ? (formatOption.value as TeamFormat) : undefined

  const team1NameOption = options.find((opt) => opt.name === "team1_name" && isBasicOption(opt))
  const team1Name = (team1NameOption && isBasicOption(team1NameOption) ? (team1NameOption.value as string) : undefined) || "チーム1"

  const team2NameOption = options.find((opt) => opt.name === "team2_name" && isBasicOption(opt))
  const team2Name = (team2NameOption && isBasicOption(team2NameOption) ? (team2NameOption.value as string) : undefined) || "チーム2"

  if (!format) {
    console.error("optionが不適切です")
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "エラー: フォーマットを選択してください", flags: MessageFlags.Ephemeral },
    })
  }

  const matchId = newId()

  // メタデータを作成
  const meta: FightingTeamOrderMeta = {
    matchId,
    format,
    createdAt: new Date().toISOString(),
  }

  // チームデータを作成（チーム名のみ）
  const team1: TeamData = { teamName: team1Name }
  const team2: TeamData = { teamName: team2Name }

  try {
    await Promise.all([redisSet(getMetaKey(matchId), meta, 86400), redisSet(getTeamKey(matchId, 1), team1, 86400), redisSet(getTeamKey(matchId, 2), team2, 86400)])

    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: createInitialMessage({ meta, teams: { team1, team2 } }),
        components: createTeamOrderButtons(matchId),
      },
    })
  } catch (error) {
    console.error("Error in handleFightingTeamOrderCommand:", error)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "⚠️ 一時的なエラーが発生しました。しばらくしてからもう一度お試しください。", flags: MessageFlags.Ephemeral },
    })
  }
}

// チーム1, 2 共通の入力モーダルを表示
export const handleOpenModalFightingTeamOrder = async (matchId: string, teamNumber: 1 | 2): Promise<NextResponse> => {
  try {
    const meta = await redisGet<FightingTeamOrderMeta>(getMetaKey(matchId))
    if (!meta) {
      return NextResponse.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: { content: "エラー: 試合情報が見つかりません", flags: MessageFlags.Ephemeral },
      })
    }

    return createTeamOrderModal(matchId, meta.format, teamNumber)
  } catch (error) {
    console.error("Error in handleOpenModalFightingTeamOrder:", error)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "⚠️ 一時的なエラーが発生しました。しばらくしてからもう一度お試しください。", flags: MessageFlags.Ephemeral },
    })
  }
}

// モーダルを生成（チーム1・チーム2共通）
const createTeamOrderModal = (matchId: string, format: TeamFormat, teamNumber: 1 | 2): NextResponse<RESTAPIInteractionCallbackResourceObject> => {
  const positions = TEAM_FORMAT_POSITIONS[format]

  // フォーマットに応じたポジションの入力フィールドを生成
  const components: APIModalInteractionResponseCallbackComponent[] = positions.map((position) => ({
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.TextInput,
        custom_id: customId(position).matchId(matchId),
        label: getPositionLabel(position),
        style: TextInputStyle.Short,
        required: true,
        placeholder: `例：プレイヤー${position.charAt(0).toUpperCase()}`,
      },
    ],
  }))

  const action = teamNumber === 1 ? CLIENT_ACTIONS.FIGHTING.REGISTER_TEAM1_ORDER : CLIENT_ACTIONS.FIGHTING.REGISTER_TEAM2_ORDER

  return NextResponse.json({
    type: InteractionResponseType.Modal,
    data: {
      custom_id: customId(action).matchId(matchId),
      title: `チーム${teamNumber} 出場順入力`,
      components,
    } satisfies APIModalInteractionResponseCallbackData,
  })
}

// モーダル送信処理（チーム1・チーム2共通）
export const handleFightingRegisterTeamOrder = async (matchId: string, teamNumber: 1 | 2, data: APIModalSubmission): Promise<NextResponse> => {
  // メタデータと両チームのデータを取得
  const [meta, team1, team2] = await Promise.all([redisGet<FightingTeamOrderMeta>(getMetaKey(matchId)), redisGet<TeamData>(getTeamKey(matchId, 1)), redisGet<TeamData>(getTeamKey(matchId, 2))])

  if (!meta || !team1 || !team2) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "エラー: 試合情報が見つかりません", flags: MessageFlags.Ephemeral },
    })
  }

  // 全てのteamFormatで先鋒と大将は必須
  const teamOrder: TeamOrderData = {
    vanguard: getValue("vanguard", data) || "",
    general: getValue("general", data) || "",
  }

  if (meta.format === "3v3") {
    teamOrder.middle = getValue("middle", data)
  }

  if (meta.format === "5v5") {
    teamOrder.second = getValue("second", data)
    teamOrder.middle = getValue("middle", data)
    teamOrder.fourth = getValue("fourth", data)
  }

  if (!teamOrder.vanguard || !teamOrder.general) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "エラー: 先鋒と大将は必須です", flags: MessageFlags.Ephemeral },
    })
  }

  const updatedTeam: TeamData = {
    teamName: teamNumber === 1 ? team1.teamName : team2.teamName,
    updatedAt: new Date().toISOString(),
    order: teamOrder,
  }

  await redisSet(getTeamKey(matchId, teamNumber), updatedTeam, 86400)

  // 更新後のチームデータを取得
  const updatedTeam1 = teamNumber === 1 ? updatedTeam : team1
  const updatedTeam2 = teamNumber === 2 ? updatedTeam : team2

  if (isOrderedTeamData(updatedTeam1) && isOrderedTeamData(updatedTeam2)) {
    return NextResponse.json({
      type: InteractionResponseType.UpdateMessage,
      data: {
        content: createCompletionMessage({ meta, teams: { team1: updatedTeam1, team2: updatedTeam2 } }),
        components: [createResetButton(matchId)],
      },
    })
  } else {
    return NextResponse.json({
      type: InteractionResponseType.UpdateMessage,
      data: {
        content: createPartialMessage({ meta, teams: { team1: updatedTeam1, team2: updatedTeam2 } }),
        components: createTeamOrderButtons(matchId),
      },
    })
  }
}

// リセットボタン処理
export const handleFightingResetTeamOrder = async (matchId: string): Promise<NextResponse> => {
  try {
    const [meta, team1, team2] = await Promise.all([redisGet<FightingTeamOrderMeta>(getMetaKey(matchId)), redisGet<TeamData>(getTeamKey(matchId, 1)), redisGet<TeamData>(getTeamKey(matchId, 2))])

    if (!meta || !team1 || !team2) {
      return NextResponse.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: { content: "エラー: 試合情報が見つかりません", flags: MessageFlags.Ephemeral },
      })
    }

    // チームデータをリセット（チーム名のみ残す）
    const resetTeam1: TeamData = { teamName: team1.teamName }
    const resetTeam2: TeamData = { teamName: team2.teamName }

    await Promise.all([redisSet(getTeamKey(matchId, 1), resetTeam1, 86400), redisSet(getTeamKey(matchId, 2), resetTeam2, 86400)])

    return NextResponse.json({
      type: InteractionResponseType.UpdateMessage,
      data: {
        content: createInitialMessage({ meta, teams: { team1: resetTeam1, team2: resetTeam2 } }),
        components: createTeamOrderButtons(matchId),
      },
    })
  } catch (error) {
    console.error("Error in handleFightingResetTeamOrder:", error)
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "⚠️ 一時的なエラーが発生しました。しばらくしてからもう一度お試しください。", flags: MessageFlags.Ephemeral },
    })
  }
}
