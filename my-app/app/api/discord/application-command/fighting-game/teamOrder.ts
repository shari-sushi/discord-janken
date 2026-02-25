import { CLIENT_ACTIONS } from "@/app/util/commands"
import { newId } from "@/app/util/newId"
import { NextResponse } from "next/server"
import { redisSet, redisGet } from "@/app/libs/redis/redis"
import { InteractionResponseType, InteractionResponseFlags, MessageComponent, MessageComponentTypes, ButtonStyleTypes, TextStyleTypes } from "discord-interactions"
import { InteractionData, MessageComponentData } from "@/app/api/discord/types"

// フォーマットごとの出場順ポジション定義
const TEAM_FORMAT_POSITIONS: Record<TeamFormat, Array<keyof TeamOrderData>> = {
  "2v2": ["vanguard", "general"],
  "3v3": ["vanguard", "middle", "general"],
  "5v5": ["vanguard", "second", "middle", "fourth", "general"],
}

// フォーマット型
type TeamFormat = "2v2" | "3v3" | "5v5"

// 出場順データ型
type TeamOrderData = {
  vanguard: string // 先鋒
  second?: string // 次鋒
  middle?: string // 中堅
  fourth?: string // 副将
  general: string // 大将
}

// メタデータ型（試合全体の管理情報のみ）redis管理
type FightingTeamOrderMeta = {
  matchId: string
  format: TeamFormat
  createdAt: string
  channelId?: string
  messageId?: string
  guildId?: string
}

// チームデータ型（チーム名 + 登録状況）redis管理
type TeamData = {
  teamName: string
  updatedAt?: string // 登録済みの場合のみ
  order?: TeamOrderData // 登録済みの場合のみ
}

// 登録済みチームデータ型
type OrderedTeamData = Required<TeamData>

const isOrderedTeamData = (team: TeamData | undefined): team is OrderedTeamData => {
  return !!team?.order && !!team?.updatedAt
}

// Redisキーを生成
const getMetaKey = (matchId: string): string => {
  return `fighting:team-order:${matchId}:meta`
}

const getTeamKey = (matchId: string, teamNumber: 1 | 2): string => {
  return `fighting:team-order:${matchId}:team:${teamNumber}`
}

// ポジション名を日本語表記で取得
const getPositionLabel = (position: keyof TeamOrderData): string => {
  const labels: Record<keyof TeamOrderData, string> = {
    vanguard: "先鋒",
    second: "次鋒",
    middle: "中堅",
    fourth: "副将",
    general: "大将",
  }
  return labels[position]
}

// フォーマットに応じた入力ボタンコンポーネントを生成
const createTeamOrderButtons = (matchId: string, disabled: boolean = false): MessageComponent[] => {
  return [
    {
      type: MessageComponentTypes.ACTION_ROW,
      components: [
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.PRIMARY,
          label: "チーム1 出場順を入力",
          custom_id: `${CLIENT_ACTIONS.FIGHTING.OPEN_MODAL_TEAM1_ORDER}?match_id=${matchId}`,
          disabled,
        },
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.PRIMARY,
          label: "チーム2 出場順を入力",
          custom_id: `${CLIENT_ACTIONS.FIGHTING.OPEN_MODAL_TEAM2_ORDER}?match_id=${matchId}`,
          disabled,
        },
      ],
    },
  ]
}

// リセットボタンコンポーネントを生成
const createResetButton = (matchId: string): MessageComponent[] => {
  return [
    {
      type: MessageComponentTypes.ACTION_ROW,
      components: [
        {
          type: MessageComponentTypes.BUTTON,
          style: ButtonStyleTypes.DANGER,
          label: "リセット",
          custom_id: `${CLIENT_ACTIONS.FIGHTING.RESET_TEAM_ORDER}?match_id=${matchId}`,
        },
      ],
    },
  ]
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
export const handleFightingTeamOrderCommand = async (options: { name: string; value: string | number }[]): Promise<NextResponse> => {
  const format = options.find((opt) => opt.name === "format")?.value as TeamFormat
  const team1Name = (options.find((opt) => opt.name === "team1_name")?.value as string) || "チーム1"
  const team2Name = (options.find((opt) => opt.name === "team2_name")?.value as string) || "チーム2"

  if (!format) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "エラー: フォーマットを選択してください", flags: InteractionResponseFlags.EPHEMERAL },
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
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: createInitialMessage({ meta, teams: { team1, team2 } }),
        components: createTeamOrderButtons(matchId),
      },
    })
  } catch (error) {
    console.error("Error in handleFightingTeamOrderCommand:", error)
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "⚠️ 一時的なエラーが発生しました。しばらくしてからもう一度お試しください。", flags: InteractionResponseFlags.EPHEMERAL },
    })
  }
}

// チーム1, 2 共通の入力モーダルを表示
export const handleOpenModalFightingTeamOrder = async (matchId: string, teamNumber: 1 | 2): Promise<NextResponse> => {
  try {
    const meta = await redisGet<FightingTeamOrderMeta>(getMetaKey(matchId))
    if (!meta) {
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "エラー: 試合情報が見つかりません", flags: InteractionResponseFlags.EPHEMERAL },
      })
    }

    return createTeamOrderModal(matchId, meta.format, teamNumber)
  } catch (error) {
    console.error("Error in handleOpenModalFightingTeamOrder:", error)
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "⚠️ 一時的なエラーが発生しました。しばらくしてからもう一度お試しください。", flags: InteractionResponseFlags.EPHEMERAL },
    })
  }
}

// モーダルを生成（チーム1・チーム2共通）
const createTeamOrderModal = (matchId: string, format: TeamFormat, teamNumber: 1 | 2): NextResponse => {
  const positions = TEAM_FORMAT_POSITIONS[format]

  // フォーマットに応じたポジションの入力フィールドを生成
  const components = positions.map((position) => ({
    type: MessageComponentTypes.ACTION_ROW,
    components: [
      {
        type: MessageComponentTypes.INPUT_TEXT,
        custom_id: `${position}?match_id=${matchId}`,
        label: getPositionLabel(position),
        style: TextStyleTypes.SHORT,
        required: true,
        placeholder: `例：プレイヤー${position.charAt(0).toUpperCase()}`,
      },
    ],
  }))

  const action = teamNumber === 1 ? CLIENT_ACTIONS.FIGHTING.REGISTER_TEAM1_ORDER : CLIENT_ACTIONS.FIGHTING.REGISTER_TEAM2_ORDER

  return NextResponse.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `${action}?match_id=${matchId}`,
      title: `チーム${teamNumber} 出場順入力`,
      components,
    },
  })
}

const getValue = (customId: string, data: InteractionData): string | undefined => {
  const components = data.components as MessageComponentData[] | undefined
  if (!components) return undefined

  const component = components.flatMap((row) => row.components || []).find((c) => c?.custom_id?.startsWith(customId))

  return component?.value
}

// モーダル送信処理（チーム1・チーム2共通）
export const handleFightingRegisterTeamOrder = async (matchId: string, teamNumber: 1 | 2, data: InteractionData): Promise<NextResponse> => {
  // メタデータと両チームのデータを取得
  const [meta, team1, team2] = await Promise.all([redisGet<FightingTeamOrderMeta>(getMetaKey(matchId)), redisGet<TeamData>(getTeamKey(matchId, 1)), redisGet<TeamData>(getTeamKey(matchId, 2))])

  if (!meta || !team1 || !team2) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "エラー: 試合情報が見つかりません", flags: InteractionResponseFlags.EPHEMERAL },
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
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "エラー: 先鋒と大将は必須です", flags: InteractionResponseFlags.EPHEMERAL },
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
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content: createCompletionMessage({ meta, teams: { team1: updatedTeam1, team2: updatedTeam2 } }),
        components: createResetButton(matchId),
      },
    })
  } else {
    return NextResponse.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
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
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "エラー: 試合情報が見つかりません", flags: InteractionResponseFlags.EPHEMERAL },
      })
    }

    // チームデータをリセット（チーム名のみ残す）
    const resetTeam1: TeamData = { teamName: team1.teamName }
    const resetTeam2: TeamData = { teamName: team2.teamName }

    await Promise.all([redisSet(getTeamKey(matchId, 1), resetTeam1, 86400), redisSet(getTeamKey(matchId, 2), resetTeam2, 86400)])

    return NextResponse.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content: createInitialMessage({ meta, teams: { team1: resetTeam1, team2: resetTeam2 } }),
        components: createTeamOrderButtons(matchId),
      },
    })
  } catch (error) {
    console.error("Error in handleFightingResetTeamOrder:", error)
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "⚠️ 一時的なエラーが発生しました。しばらくしてからもう一度お試しください。", flags: InteractionResponseFlags.EPHEMERAL },
    })
  }
}
