import { CLIENT_ACTIONS } from "@/app/_server/util/commands"
import { newId } from "@/app/_server/util/newId"
import { NextResponse } from "next/server"
import { redisSet, redisGet, redisMGet, redisDelete } from "@/app/_server/lib/redis/redis"
import { createProtectComponents } from "../../_util/createProtectMessageComponents"
import { RegisteredTeamData, ProtectMatchMeta, TeamSide } from "@/app/domains/lol/types"
import { getMatchKey } from "@/app/domains/lol/_server/redisKeys"
import { APIModalInteractionResponseCallbackComponent, APIModalSubmission, ComponentType, InteractionResponseType, MessageFlags, TextInputStyle, APIEmbed } from "discord-api-types/v10"
import { getValue } from "../../_util/getComponentValue"
import { customId } from "../../_util/customId"
import { createSingleTeamRegistrationMessage } from "./util/createSingleTeamRegistrationEmbedData"
import { createCompletionEmbedData } from "./util/createCompletionEmbedData"
import { getMatchStatusMessage } from "./util/getMatchStatusMessage"
import { isBothTeamRegistered } from "./util/isBothTeamRegistered"
import { editDiscordMessageAfter, sendFollowupMessageAfter } from "@/app/_server/lib/discord/api"

// コマンド初期表示
export const newMatchCommand = async (): Promise<NextResponse> => {
  const matchId = newId()

  // メタデータを作成・保存
  const meta: ProtectMatchMeta = {
    match_id: matchId,
    created_at: new Date().toISOString(),
    rules: {
      isProtect: true,
      isRoleSelect: false,
    },
  }
  await redisSet(getMatchKey(matchId, "meta"), meta)

  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: "自分のチームのプロテクトを入力してください",
      components: createProtectComponents(matchId),
    },
  })
}

// プロテクト・ロール入力 モーダル表示（共通処理）
export const handleOpenModalProtectRole = async (teamSide: TeamSide, matchId: string, messageId: string): Promise<NextResponse> => {
  const isBlue = teamSide === "blue_team"

  // メタデータ取得
  const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))

  if (!meta) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "エラー: 試合情報が見つかりません", flags: MessageFlags.Ephemeral },
    })
  }

  // どちらもfalseの場合
  if (!meta.rules.isProtect && !meta.rules.isRoleSelect) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "入力が求められている情報がありません。プロテクトの宣言もロール振り分けも不要です。", flags: MessageFlags.Ephemeral },
    })
  }

  // モーダルのcomponentsを構築
  const components: APIModalInteractionResponseCallbackComponent[] = []

  // プロテクト入力（isProtect: trueの場合）
  if (meta.rules.isProtect) {
    components.push({
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.TextInput,
          custom_id: customId("protection_champions").matchId(matchId),
          label: "プロテクトするチャンプを入力",
          style: TextInputStyle.Short,
          required: true,
          placeholder: isBlue ? "例：モルガナ、メル" : "例：ヴェルコズ、ニーコ",
        },
      ],
    })
  }

  // ロール選択（isRoleSelect: trueの場合）
  if (meta.rules.isRoleSelect) {
    if (!meta.members) {
      return NextResponse.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: { content: "エラー: メンバー情報が見つかりません", flags: MessageFlags.Ephemeral },
      })
    }

    const teamMembers = isBlue ? meta.members.blueTeam : meta.members.redTeam
    const roleOptions = teamMembers.map((member) => ({ label: member, value: member }))

    // Top
    components.push({
      type: ComponentType.Label,
      label: "Top",
      component: {
        type: ComponentType.StringSelect,
        custom_id: customId("role_top").matchId(matchId),
        placeholder: "Topを選択",
        options: roleOptions,
        required: true,
      },
    })

    // Jungle
    components.push({
      type: ComponentType.Label,
      label: "Jungle",
      component: {
        type: ComponentType.StringSelect,
        custom_id: customId("role_jg").matchId(matchId),
        placeholder: "Jungleを選択",
        options: roleOptions,
        required: true,
      },
    })

    // Mid
    components.push({
      type: ComponentType.Label,
      label: "Mid",
      component: {
        type: ComponentType.StringSelect,
        custom_id: customId("role_mid").matchId(matchId),
        placeholder: "Midを選択",
        options: roleOptions,
        required: true,
      },
    })

    // ADC
    components.push({
      type: ComponentType.Label,
      label: "ADC",
      component: {
        type: ComponentType.StringSelect,
        custom_id: customId("role_adc").matchId(matchId),
        placeholder: "ADCを選択",
        options: roleOptions,
        required: true,
      },
    })
  }

  const action = isBlue ? CLIENT_ACTIONS.LOL.REGISTER_BLUE_TEAM : CLIENT_ACTIONS.LOL.REGISTER_RED_TEAM
  return NextResponse.json({
    type: InteractionResponseType.Modal,
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
  data: APIModalSubmission
  interactionToken: string
}

type handleRegisterTeamResult = {
  response: NextResponse
  isBothTeamsRegistered: boolean
  followupMessage?: { content?: string; embeds?: APIEmbed[] }
  interactionToken: string
}

// チーム情報の登録処理
export const handleRegisterTeam = async ({ matchId, userId, teamSide, data, interactionToken }: handleRegisterTeamArgs): Promise<handleRegisterTeamResult> => {
  console.log("handleRegisterTeam by", teamSide, "data:", JSON.stringify(data, null, 2))

  // 1. メタデータ取得
  const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))
  console.log("Meta data retrieved:", JSON.stringify(meta, null, 2))

  if (!meta) {
    console.error("Meta not found for matchId:", matchId)
    return {
      response: NextResponse.json({ type: InteractionResponseType.ChannelMessageWithSource, data: { content: "エラー: 試合情報が見つかりません", flags: MessageFlags.Ephemeral } }),
      isBothTeamsRegistered: false,
      interactionToken,
    }
  }

  // 2. プロテクトチャンピオン取得（meta.isProtect === true の場合のみ）
  const protectionChampions = meta.rules.isProtect ? getValue("protection_champions", data) : undefined
  console.log(teamSide, "- Protection champions:", protectionChampions)

  // 3. ロール選択の処理（meta.isRoleSelect === true の場合のみ）
  let roster: { top: string; jg: string; mid: string; adc: string; sup: string } | undefined

  if (meta.rules.isRoleSelect) {
    const top = getValue("role_top", data)
    const jg = getValue("role_jg", data)
    const mid = getValue("role_mid", data)
    const adc = getValue("role_adc", data)

    if (!top || !jg || !mid || !adc) {
      console.error("ロール選択エラー")
      return {
        response: NextResponse.json({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: { content: "エラー: 全てのロールに選手を割り振ってください", flags: MessageFlags.Ephemeral },
        }),
        isBothTeamsRegistered: false,
        interactionToken,
      }
    }

    const selectedMembers = [top, jg, mid, adc]

    const uniqueMembers = new Set(selectedMembers)
    if (uniqueMembers.size !== 4) {
      return {
        response: NextResponse.json({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: { content: "エラー: 同じメンバーが複数のロールに選択されています", flags: MessageFlags.Ephemeral },
        }),
        isBothTeamsRegistered: false,
        interactionToken,
      }
    }

    // メタデータからメンバー配列を取得
    if (!meta.members) {
      return {
        response: NextResponse.json({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: { content: "エラー: メンバー情報が見つかりません", flags: MessageFlags.Ephemeral },
        }),
        isBothTeamsRegistered: false,
        interactionToken,
      }
    }

    const teamMembers = teamSide === "blue_team" ? meta.members.blueTeam : meta.members.redTeam

    // 残り1人をsupとして自動割り当て
    const supMember = teamMembers.find((m) => !selectedMembers.includes(m))
    if (!supMember) {
      return {
        response: NextResponse.json({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: { content: "エラー: Supportロールに割り当てるメンバーが見つかりません", flags: MessageFlags.Ephemeral },
        }),
        isBothTeamsRegistered: false,
        interactionToken,
      }
    }

    roster = { top, jg, mid, adc, sup: supMember }
  }

  // 4. Redisに保存
  const usTeamKey = getMatchKey(matchId, teamSide)
  const usTeamData: RegisteredTeamData = {
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
  const otherTeamData = await redisGet<RegisteredTeamData>(otherTeamKey)
  console.log(teamSide, "-", otherTeamSide, "data:", JSON.stringify(otherTeamData, null, 2))

  // 7. メッセージ返却
  if (!isBothTeamRegistered(meta.rules, usTeamData, otherTeamData)) {
    console.log(teamSide, "- Single team completed (not both)")
    console.log(teamSide, "- Returning single team completion message")
    const messageData = createSingleTeamRegistrationMessage(teamSide, meta, usTeamData)
    if (messageData == null) {
      console.error("messageData is null")
      return {
        response: NextResponse.json({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "データの不整合が発生しました。試合作成からやり直すか、開発者にお問い合わせください。",
            flags: MessageFlags.Ephemeral,
          },
        }),
        isBothTeamsRegistered: false,
        interactionToken,
      }
    }

    const blueStatus = teamSide === "blue_team" ? `✅登録済 (by <@${userId}>)` : "✍️未登録"
    const redStatus = teamSide === "red_team" ? `✅登録済 (by <@${userId}>)` : "✍️未登録"
    const statusMessage = `🟦 ブルーサイド：${blueStatus}\n🟥 レッドサイド：${redStatus}`

    return {
      response: NextResponse.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          ...messageData,
          flags: MessageFlags.Ephemeral,
        },
      }),
      isBothTeamsRegistered: false,
      followupMessage: { content: statusMessage },
      interactionToken,
    }
  }

  console.log(teamSide, "- Returning completion embed")
  // 両チーム完了時: エフェメラルで自分のチーム確認、全員向けには結果発表Embed
  const singleTeamMessageData = createSingleTeamRegistrationMessage(teamSide, meta, usTeamData)
  if (singleTeamMessageData == null) {
    console.error("singleTeamMessageData is null in completion phase")
    return {
      response: NextResponse.json({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "データの不整合が発生しました。試合作成からやり直すか、開発者にお問い合わせください。",
          flags: MessageFlags.Ephemeral,
        },
      }),
      isBothTeamsRegistered: false,
      interactionToken,
    }
  }

  const completionEmbedData = createCompletionEmbedData(meta, {
    blue: teamSide === "blue_team" ? usTeamData : otherTeamData!,
    red: teamSide === "blue_team" ? otherTeamData! : usTeamData,
  })

  return {
    response: NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        ...singleTeamMessageData,
        flags: MessageFlags.Ephemeral,
      },
    }),
    isBothTeamsRegistered: true,
    followupMessage: { embeds: completionEmbedData.embeds },
    interactionToken,
  }
}

// 登録状況確認
export const handleCheckRegistered = async (matchId: string): Promise<NextResponse> => {
  const messageData = await getMatchStatusMessage(matchId)

  if (!messageData) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "エラー: 試合情報が見つかりません", flags: MessageFlags.Ephemeral },
    })
  }

  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: { ...messageData, flags: MessageFlags.Ephemeral },
  })
}

// 登録のリセット
export const handleResetRegistered = async (matchId: string): Promise<NextResponse> => {
  // 1. メタデータ取得
  const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))
  if (!meta) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "エラー: 試合情報が見つかりません", flags: MessageFlags.Ephemeral },
    })
  }

  // 2. 両チームデータ一括取得（MGET使用）
  const teamKeys = [getMatchKey(matchId, "blue_team"), getMatchKey(matchId, "red_team")]
  const [blueTeamData, redTeamData] = await redisMGet<RegisteredTeamData>(teamKeys)

  if (blueTeamData && redTeamData) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "エラー: 両チーム登録済みのためリセットできません", flags: MessageFlags.Ephemeral },
    })
  }

  if (!blueTeamData && !redTeamData) {
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "エラー: 両チーム未登録のため、リセットするデータがありません", flags: MessageFlags.Ephemeral },
    })
  }

  if (blueTeamData) {
    await redisDelete(getMatchKey(matchId, "blue_team"))
    return NextResponse.json({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "ブルーチームのデータを削除しました" },
    })
  }

  await redisDelete(getMatchKey(matchId, "red_team"))
  return NextResponse.json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: { content: "レッドチームのデータを削除しました" },
  })
}

type PostTeamRegistrationArgs = {
  matchId: string
  messageId: string
  channelId: string
  response: NextResponse
  isBothTeamsRegistered: boolean
  followupMessage?: { content?: string; embeds?: APIEmbed[] }
  interactionToken: string
}

/**
 * チーム登録後の処理（Follow-upメッセージ送信、メッセージ編集）
 */
export const postTeamRegistration = ({ matchId, messageId, channelId, response, isBothTeamsRegistered, followupMessage, interactionToken }: PostTeamRegistrationArgs): NextResponse => {
  // Follow-upメッセージ送信
  if (followupMessage != null) {
    sendFollowupMessageAfter(interactionToken, followupMessage)
  }

  // 両チーム完了時: 元のメッセージを編集して完了を通知
  if (isBothTeamsRegistered && messageId !== "" && channelId !== "") {
    editDiscordMessageAfter(channelId, messageId, "✅ 両チームの入力が完了し、結果が発表されました", createProtectComponents(matchId, true))
  }

  return response
}
