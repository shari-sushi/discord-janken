import { CLIENT_ACTIONS } from "@/app/util/commands"
import { newId } from "@/app/util/newId"
import { NextResponse } from "next/server"
import { redisSet, redisGet, redisMGet, redisDelete } from "@/app/libs/redis/redis"
import { createProtectComponents } from "../../util/protectMessageComponents"
import { ProtectTeamData, ProtectMatchMeta, TeamSide } from "@/app/types/match"
import { getMatchKey } from "@/app/util/redisKeys"

// コマンド初期表示
export const newMatchCommand = async () => {
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
    type: 4,
    data: {
      content: "自分のチームのプロテクトを入力してください",
      components: createProtectComponents(matchId),
    },
  })
}

/**
 * モーダル送信データから custom_id で値を取得
 * @param customId - 検索する custom_id（前方一致）
 * @param data - モーダル送信データ
 * @returns 取得した値（Text Input の value または Select Menu の values[0]）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getValue(customId: string, data: any): string | undefined {
  const component = data.components
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .flatMap((row: any) => {
      // Text Input の場合: row.components (配列)
      if (row.components) {
        return row.components
      }
      // Select Menu の場合: row.component (単数形オブジェクト)
      if (row.component) {
        return [row.component]
      }
      return []
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .find((c: any) => c?.custom_id?.startsWith(customId))

  // Text Input の場合は value、Select Menu の場合は values[0]
  return component?.value ?? component?.values?.[0]
}

/**
 * 両チーム完了時のEmbedデータを生成（3カラムテーブル形式）
 */
function createCompletionEmbedData(meta: ProtectMatchMeta, teamsData: { blue: ProtectTeamData; red: ProtectTeamData }) {
  // 左カラム（項目名）の値を構築
  const leftColumnLines: string[] = []

  // 中央カラム（ブルーチーム）の値を構築
  const blueColumnLines: string[] = []

  // 右カラム（レッドチーム）の値を構築
  const redColumnLines: string[] = []

  // プロテクト行（isProtect が true の場合のみ）
  if (meta.isProtect && teamsData.blue.protection_champions && teamsData.red.protection_champions) {
    leftColumnLines.push("プロテクト    ")
    blueColumnLines.push(teamsData.blue.protection_champions)
    redColumnLines.push(teamsData.red.protection_champions)

    // protectとroleの間に改行を入れる
    if (meta.isRoleSelect) {
      leftColumnLines.push("\u200B")
      blueColumnLines.push("\u200B")
      redColumnLines.push("\u200B")
    }
  }

  // ロール行（isRoleSelect が true の場合のみ）
  if (meta.isRoleSelect && teamsData.blue.roster && teamsData.red.roster) {
    leftColumnLines.push("TOP", "JG", "MID", "ADC", "SUP")
    blueColumnLines.push(teamsData.blue.roster.top, teamsData.blue.roster.jg, teamsData.blue.roster.mid, teamsData.blue.roster.adc, teamsData.blue.roster.sup)
    redColumnLines.push(teamsData.red.roster.top, teamsData.red.roster.jg, teamsData.red.roster.mid, teamsData.red.roster.adc, teamsData.red.roster.sup)
  }

  // fieldsを構築
  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    {
      name: "\u200B",
      value: leftColumnLines.join("\n"),
      inline: true,
    },
    {
      name: "🟦ブルーサイド",
      value: blueColumnLines.join("\n"),
      inline: true,
    },
    {
      name: "🟥レッドサイド",
      value: redColumnLines.join("\n"),
      inline: true,
    },
  ]

  return {
    embeds: [
      {
        title: "✅ 結果発表",
        color: 3447003,
        fields,
      },
    ],
  }
}

/**
 * 両チーム完了時のEmbedメッセージを生成（3カラムテーブル形式）
 */
function createCompletionEmbed(meta: ProtectMatchMeta, teamsData: { blue: ProtectTeamData; red: ProtectTeamData }) {
  return NextResponse.json({
    type: 4,
    data: createCompletionEmbedData(meta, teamsData),
  })
}

// プロテクト・ロール入力 モーダル表示（共通処理）
export const handleOpenModalProtectRole = async (teamSide: TeamSide, matchId: string, messageId: string): Promise<NextResponse> => {
  const isBlue = teamSide === "blue_team"

  // メタデータ取得
  const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))

  if (!meta) {
    return NextResponse.json({
      type: 4,
      data: { content: "エラー: 試合情報が見つかりません", flags: 64 },
    })
  }

  // どちらもfalseの場合
  if (!meta.isProtect && !meta.isRoleSelect) {
    return NextResponse.json({
      type: 4,
      data: { content: "入力が求められている情報がありません。プロテクトの宣言もロール振り分けも不要です。", flags: 64 },
    })
  }

  // モーダルのcomponentsを構築
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components: any[] = []

  // プロテクト入力（isProtect: trueの場合）
  if (meta.isProtect) {
    components.push({
      type: 1, // Action Row
      components: [
        {
          type: 4, // Text Input
          custom_id: `protection_champions?match_id=${matchId}`,
          label: "プロテクトするチャンプを入力",
          style: 1,
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
        type: 4,
        data: { content: "エラー: メンバー情報が見つかりません", flags: 64 },
      })
    }

    const teamMembers = isBlue ? meta.members.blueTeam : meta.members.redTeam
    const roleOptions = teamMembers.map((member) => ({ label: member, value: member }))

    // Top
    components.push({
      type: 18, // Label
      label: "Top",
      component: {
        type: 3, // Select Menu
        custom_id: `role_top?match_id=${matchId}`,
        placeholder: "Topを選択",
        options: roleOptions,
        required: true,
      },
    })

    // Jungle
    components.push({
      type: 18, // Label
      label: "Jungle",
      component: {
        type: 3, // Select Menu
        custom_id: `role_jg?match_id=${matchId}`,
        placeholder: "Jungleを選択",
        options: roleOptions,
        required: true,
      },
    })

    // Mid
    components.push({
      type: 18, // Label
      label: "Mid",
      component: {
        type: 3, // Select Menu
        custom_id: `role_mid?match_id=${matchId}`,
        placeholder: "Midを選択",
        options: roleOptions,
        required: true,
      },
    })

    // ADC
    components.push({
      type: 18, // Label
      label: "ADC",
      component: {
        type: 3, // Select Menu
        custom_id: `role_adc?match_id=${matchId}`,
        placeholder: "ADCを選択",
        options: roleOptions,
        required: true,
      },
    })
  }

  const action = isBlue ? CLIENT_ACTIONS.LOL.REGISTER_BLUE_TEAM : CLIENT_ACTIONS.LOL.REGISTER_RED_TEAM
  return NextResponse.json({
    type: 9,
    data: {
      custom_id: action + `?message_id=${messageId}`,
      title: isBlue ? "ブルーサイド" : "レッドサイド",
      components,
    },
  })
}

type handleRegisterTeamArgs = {
  matchId: string
  userId: string
  teamSide: TeamSide
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
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
      response: NextResponse.json({ type: 4, data: { content: "エラー: 試合情報が見つかりません", flags: 64 } }),
      isBothTeamsRegistered: false,
    }
  }

  // 2. プロテクトチャンピオン取得（meta.isProtect === true の場合のみ）
  const protectionChampions = meta.isProtect ? getValue("protection_champions", data) : undefined
  console.log(teamSide, "- Protection champions:", protectionChampions)

  // 3. ロール選択の処理（meta.isRoleSelect === true の場合のみ）
  let roster: { top: string; jg: string; mid: string; adc: string; sup: string } | undefined

  if (meta.isRoleSelect) {
    // getValue関数を使用してcustom_idベースで取得
    const top = getValue("role_top", data)
    const jg = getValue("role_jg", data)
    const mid = getValue("role_mid", data)
    const adc = getValue("role_adc", data)

    // バリデーション: 全てのロールが選択されていることを確認
    if (!top || !jg || !mid || !adc) {
      console.error("ロール選択エラー: top:", top, ", jg", jg, ", mid:", mid, " adc:", adc)
      return {
        response: NextResponse.json({ type: 4, data: { content: "エラー: 全てのロールに選手を割り振ってください", flags: 64 } }),
        isBothTeamsRegistered: false,
      }
    }

    // 選択された4人を配列化
    const selectedMembers = [top, jg, mid, adc]

    // 重複チェック
    const uniqueMembers = new Set(selectedMembers)
    if (uniqueMembers.size !== 4) {
      return {
        response: NextResponse.json({ type: 4, data: { content: "エラー: 同じメンバーが複数のロールに選択されています", flags: 64 } }),
        isBothTeamsRegistered: false,
      }
    }

    // メタデータからメンバー配列を取得
    if (!meta.members) {
      return {
        response: NextResponse.json({ type: 4, data: { content: "エラー: メンバー情報が見つかりません", flags: 64 } }),
        isBothTeamsRegistered: false,
      }
    }

    const teamMembers = teamSide === "blue_team" ? meta.members.blueTeam : meta.members.redTeam

    // 残り1人をsupとして自動割り当て
    const supMember = teamMembers.find((m) => !selectedMembers.includes(m))
    if (!supMember) {
      return {
        response: NextResponse.json({ type: 4, data: { content: "エラー: Supportロールに割り当てるメンバーが見つかりません", flags: 64 } }),
        isBothTeamsRegistered: false,
      }
    }

    // 最終的なroster
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
      response: NextResponse.json({ type: 4, data: { content: teamSide === "blue_team" ? `🟦 ブルーサイド登録完了 (登録者<@${userId}>)` : `🟥 レッドサイド登録完了 (登録者<@${userId}>)` } }),
      isBothTeamsRegistered: false,
    }
  }
}

/**
 * 試合データを取得してメッセージデータを返す
 * @param matchId - 試合ID
 * @returns メッセージデータ（content または embeds）、データが見つからない場合は null
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getMatchStatusMessage = async (matchId: string): Promise<{ content?: string; embeds?: any[] } | null> => {
  // 1. メタデータ取得
  const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))
  if (!meta) {
    return null
  }

  // 2. 両チームデータ一括取得（MGET使用）
  const teamKeys = [getMatchKey(matchId, "blue_team"), getMatchKey(matchId, "red_team")]
  const [blueTeamData, redTeamData] = await redisMGet<ProtectTeamData>(teamKeys)

  // 3. 両チーム完了判定
  const isBothRegistered =
    redTeamData && blueTeamData && (!meta.isProtect || (blueTeamData.protection_champions && redTeamData.protection_champions)) && (!meta.isRoleSelect || (blueTeamData.roster && redTeamData.roster))

  const teamsData = {
    blue: blueTeamData!,
    red: redTeamData!,
  }

  // 4. メッセージデータ構築
  if (isBothRegistered) {
    // 両チーム完了時はEmbed形式で表示
    return createCompletionEmbedData(meta, teamsData)
  } else if (!redTeamData && !blueTeamData) {
    // 両チーム未登録
    return { content: "🟦 ブルーサイド：✍️未登録\n🟥 レッドサイド：✍️未登録" }
  } else if (!blueTeamData) {
    // ブルーチームのみ未登録
    return { content: "🟦 ブルーサイド：✅登録済み\n🟥 レッドサイド：✍️未登録" }
  } else {
    // レッドチームのみ未登録
    return { content: "🟥 レッドサイド：✅登録済み\n🟦 ブルーサイド：✍️未登録" }
  }
}

// 登録状況確認
export const handleCheckRegistered = async (matchId: string): Promise<NextResponse> => {
  const messageData = await getMatchStatusMessage(matchId)

  if (!messageData) {
    return NextResponse.json({
      type: 4,
      data: { content: "エラー: 試合情報が見つかりません", flags: 64 },
    })
  }

  return NextResponse.json({
    type: 4,
    data: { ...messageData, flags: 64 },
  })
}

// 登録のリセット
export const handleResetRegistered = async (matchId: string): Promise<NextResponse> => {
  // 1. メタデータ取得
  const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))
  if (!meta) {
    return NextResponse.json({
      type: 4,
      data: { content: "エラー: 試合情報が見つかりません", flags: 64 },
    })
  }

  // 2. 両チームデータ一括取得（MGET使用）
  const teamKeys = [getMatchKey(matchId, "blue_team"), getMatchKey(matchId, "red_team")]
  const [blueTeamData, redTeamData] = await redisMGet<ProtectTeamData>(teamKeys)

  if (blueTeamData && redTeamData) {
    return NextResponse.json({
      type: 4,
      data: { content: "エラー: 両チーム登録済みのためリセットできません", flags: 64 },
    })
  }

  if (!blueTeamData && !redTeamData) {
    return NextResponse.json({
      type: 4,
      data: { content: "エラー: 両チーム未登録のため、リセットするデータがありません", flags: 64 },
    })
  }

  if (blueTeamData) {
    await redisDelete(getMatchKey(matchId, "blue_team"))
    return NextResponse.json({
      type: 4,
      data: { content: "ブルーチームのデータを削除しました" },
    })
  }

  await redisDelete(getMatchKey(matchId, "red_team"))
  return NextResponse.json({
    type: 4,
    data: { content: "レッドチームのデータを削除しました" },
  })
}
