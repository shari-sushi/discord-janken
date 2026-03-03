import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { newId } from "@/app/_server/util/newId"
import { NextResponse } from "next/server"
import { redisSet, redisGet, redisMGet, redisDelete } from "@/app/_server/lib/redis/redis"
import { createProtectComponents } from "../../util/createProtectMessageComponents"
import { ProtectTeamData, ProtectMatchMeta, TeamSide } from "@/app/domains/lol/types"
import { getMatchKey } from "@/app/domains/lol/_server/redisKeys"
import { InteractionResponseType, InteractionResponseFlags, MessageComponentTypes, TextStyleTypes } from "discord-interactions"
import { InteractionData } from "@/app/_server/lib/discord/types"
import { getValue } from "../../util/getComponentValue"
import { customId } from "../../util/customId"
import { createCompletionEmbedData } from "./util/createCompletionEmbedData"
import { getMatchStatusMessage } from "./util/getMatchStatusMessage"

// コマンド初期表示
export const newMatchCommand = async (): Promise<NextResponse> => {
  const matchId = newId()

  // メタデータを作成・保存
  const meta: ProtectMatchMeta = {
    match_id: matchId,
    created_at: new Date().toISOString(),
    isProtect: true,
    isRoleSelect: false,
  }
  await redisSet(getMatchKey(matchId, "meta"), meta)

  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: "自分のチームのプロテクトを入力してください",
      components: createProtectComponents(matchId),
    },
  })
}

/**
 * 両チーム完了時のEmbedメッセージを生成（3カラムテーブル形式）
 */
function createCompletionEmbed(meta: ProtectMatchMeta, teamData: { blue: ProtectTeamData; red: ProtectTeamData }) {
  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: createCompletionEmbedData(meta, teamData),
  })
}

// プロテクト・ロール入力 モーダル表示（共通処理）
export const handleOpenModalProtectRole = async (teamSide: TeamSide, matchId: string, messageId: string): Promise<NextResponse> => {
  const isBlue = teamSide === "blue_team"

  // メタデータ取得
  const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))

  if (!meta) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "エラー: 試合情報が見つかりません", flags: InteractionResponseFlags.EPHEMERAL },
    })
  }

  // どちらもfalseの場合
  if (!meta.isProtect && !meta.isRoleSelect) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "入力が求められている情報がありません。プロテクトの宣言もロール振り分けも不要です。", flags: InteractionResponseFlags.EPHEMERAL },
    })
  }

  // モーダルのcomponentsを構築
  const components: Array<Record<string, unknown>> = []

  // プロテクト入力（isProtect: trueの場合）
  if (meta.isProtect) {
    components.push({
      type: MessageComponentTypes.ACTION_ROW,
      components: [
        {
          type: MessageComponentTypes.INPUT_TEXT,
          custom_id: customId("protection_champions").matchId(matchId),
          label: "プロテクトするチャンプを入力",
          style: TextStyleTypes.SHORT,
          required: true,
          placeholder: isBlue ? "例：モルガナ、メル" : "例：ヴェルコズ、ニーコ",
        },
      ],
    })
  }

  // ロール選択（isRoleSelect: trueの場合）
  if (meta.isRoleSelect) {
    if (!meta.members) {
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "エラー: メンバー情報が見つかりません", flags: InteractionResponseFlags.EPHEMERAL },
      })
    }

    const teamMembers = isBlue ? meta.members.blueTeam : meta.members.redTeam
    const roleOptions = teamMembers.map((member) => ({ label: member, value: member }))

    // Top
    components.push({
      type: MessageComponentTypes.LABEL,
      label: "Top",
      component: {
        type: MessageComponentTypes.STRING_SELECT,
        custom_id: customId("role_top").matchId(matchId),
        placeholder: "Topを選択",
        options: roleOptions,
        required: true,
      },
    })

    // Jungle
    components.push({
      type: MessageComponentTypes.LABEL,
      label: "Jungle",
      component: {
        type: MessageComponentTypes.STRING_SELECT,
        custom_id: customId("role_jg").matchId(matchId),
        placeholder: "Jungleを選択",
        options: roleOptions,
        required: true,
      },
    })

    // Mid
    components.push({
      type: MessageComponentTypes.LABEL,
      label: "Mid",
      component: {
        type: MessageComponentTypes.STRING_SELECT,
        custom_id: customId("role_mid").matchId(matchId),
        placeholder: "Midを選択",
        options: roleOptions,
        required: true,
      },
    })

    // ADC
    components.push({
      type: MessageComponentTypes.LABEL,
      label: "ADC",
      component: {
        type: MessageComponentTypes.STRING_SELECT,
        custom_id: customId("role_adc").matchId(matchId),
        placeholder: "ADCを選択",
        options: roleOptions,
        required: true,
      },
    })
  }

  const action = isBlue ? CLIENT_ACTIONS.LOL.REGISTER_BLUE_TEAM : CLIENT_ACTIONS.LOL.REGISTER_RED_TEAM
  return NextResponse.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: customId(action).messageId(messageId),
      title: isBlue ? "ブルーサイド" : "レッドサイド",
      components,
    },
  })
}

type handleRegisterTeamArgs = {
  matchId: string
  userId: string
  teamSide: TeamSide
  data: InteractionData
}

// チーム情報の登録処理
export const handleRegisterTeam = async ({ matchId, userId, teamSide, data }: handleRegisterTeamArgs): Promise<{ response: NextResponse; isBothTeamsRegistered: boolean }> => {
  console.log("handleRegisterTeam by", teamSide, "data:", JSON.stringify(data, null, 2))

  // 1. メタデータ取得
  const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))
  console.log("Meta data retrieved:", JSON.stringify(meta, null, 2))

  if (!meta) {
    console.error("Meta not found for matchId:", matchId)
    return {
      response: NextResponse.json({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "エラー: 試合情報が見つかりません", flags: InteractionResponseFlags.EPHEMERAL } }),
      isBothTeamsRegistered: false,
    }
  }

  // 2. プロテクトチャンピオン取得（meta.isProtect === true の場合のみ）
  const protectionChampions = meta.isProtect ? getValue("protection_champions", data) : undefined
  console.log(teamSide, "- Protection champions:", protectionChampions)

  // 3. ロール選択の処理（meta.isRoleSelect === true の場合のみ）
  let roster: { top: string; jg: string; mid: string; adc: string; sup: string } | undefined

  if (meta.isRoleSelect) {
    const top = getValue("role_top", data)
    const jg = getValue("role_jg", data)
    const mid = getValue("role_mid", data)
    const adc = getValue("role_adc", data)

    if (!top || !jg || !mid || !adc) {
      console.error("ロール選択エラー")
      return {
        response: NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "エラー: 全てのロールに選手を割り振ってください", flags: InteractionResponseFlags.EPHEMERAL },
        }),
        isBothTeamsRegistered: false,
      }
    }

    const selectedMembers = [top, jg, mid, adc]

    const uniqueMembers = new Set(selectedMembers)
    if (uniqueMembers.size !== 4) {
      return {
        response: NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "エラー: 同じメンバーが複数のロールに選択されています", flags: InteractionResponseFlags.EPHEMERAL },
        }),
        isBothTeamsRegistered: false,
      }
    }

    // メタデータからメンバー配列を取得
    if (!meta.members) {
      return {
        response: NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "エラー: メンバー情報が見つかりません", flags: InteractionResponseFlags.EPHEMERAL },
        }),
        isBothTeamsRegistered: false,
      }
    }

    const teamMembers = teamSide === "blue_team" ? meta.members.blueTeam : meta.members.redTeam

    // 残り1人をsupとして自動割り当て
    const supMember = teamMembers.find((m) => !selectedMembers.includes(m))
    if (!supMember) {
      return {
        response: NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "エラー: Supportロールに割り当てるメンバーが見つかりません", flags: InteractionResponseFlags.EPHEMERAL },
        }),
        isBothTeamsRegistered: false,
      }
    }

    roster = { top, jg, mid, adc, sup: supMember }
  }

  // 4. Redisに保存
  const usTeamKey = getMatchKey(matchId, teamSide)
  const usTeamData: ProtectTeamData = {
    updated_at: new Date().toISOString(),
    ...(protectionChampions && { protection_champions: protectionChampions }),
    ...(roster && { roster }),
  }
  console.log(teamSide, "- Saving to Redis with key:", usTeamKey)
  console.log(teamSide, "- Data to save:", JSON.stringify(usTeamData, null, 2))
  await redisSet(usTeamKey, usTeamData)
  console.log(teamSide, "- Save completed")

  const otherTeamSide = teamSide === "blue_team" ? "red_team" : "blue_team"
  // 5. 相手チーム確認
  const otherTeamKey = getMatchKey(matchId, otherTeamSide)
  const otherTeamData = await redisGet<ProtectTeamData>(otherTeamKey)
  console.log(teamSide, "-", otherTeamSide, "data:", JSON.stringify(otherTeamData, null, 2))

  // 6. 両チーム完了判定
  const isBothRegistered =
    otherTeamData && (!meta.isProtect || (usTeamData.protection_champions && otherTeamData.protection_champions)) && (!meta.isRoleSelect || (usTeamData.roster && otherTeamData.roster))
  console.log(teamSide, "- Both complete?", isBothRegistered)

  // 7. メッセージ返却
  if (isBothRegistered) {
    console.log(teamSide, "- Returning completion embed")
    // 両チーム完了時はEmbed形式で結果を表示
    // teamSideに応じてblue/redを正しい順序で渡す
    const teamsData = {
      blue: teamSide === "blue_team" ? usTeamData : otherTeamData!,
      red: teamSide === "blue_team" ? otherTeamData! : usTeamData,
    }
    return { response: createCompletionEmbed(meta, teamsData), isBothTeamsRegistered: true }
  } else {
    console.log(teamSide, "- Returning single team completion message")
    return {
      response: NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: teamSide === "blue_team" ? `🟦 ブルーサイド登録完了 (登録者<@${userId}>)` : `🟥 レッドサイド登録完了 (登録者<@${userId}>)` },
      }),
      isBothTeamsRegistered: false,
    }
  }
}

// 登録状況確認
export const handleCheckRegistered = async (matchId: string): Promise<NextResponse> => {
  const messageData = await getMatchStatusMessage(matchId)

  if (!messageData) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "エラー: 試合情報が見つかりません", flags: InteractionResponseFlags.EPHEMERAL },
    })
  }

  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { ...messageData, flags: InteractionResponseFlags.EPHEMERAL },
  })
}

// 登録のリセット
export const handleResetRegistered = async (matchId: string): Promise<NextResponse> => {
  // 1. メタデータ取得
  const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))
  if (!meta) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "エラー: 試合情報が見つかりません", flags: InteractionResponseFlags.EPHEMERAL },
    })
  }

  // 2. 両チームデータ一括取得（MGET使用）
  const teamKeys = [getMatchKey(matchId, "blue_team"), getMatchKey(matchId, "red_team")]
  const [blueTeamData, redTeamData] = await redisMGet<ProtectTeamData>(teamKeys)

  if (blueTeamData && redTeamData) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "エラー: 両チーム登録済みのためリセットできません", flags: InteractionResponseFlags.EPHEMERAL },
    })
  }

  if (!blueTeamData && !redTeamData) {
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "エラー: 両チーム未登録のため、リセットするデータがありません", flags: InteractionResponseFlags.EPHEMERAL },
    })
  }

  if (blueTeamData) {
    await redisDelete(getMatchKey(matchId, "blue_team"))
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "ブルーチームのデータを削除しました" },
    })
  }

  await redisDelete(getMatchKey(matchId, "red_team"))
  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "レッドチームのデータを削除しました" },
  })
}
