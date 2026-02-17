import { CLIENT_ACTIONS } from "@/app/util/commands"
import { newId } from "@/app/util/newId"
import { NextResponse } from "next/server"
import { redisSet, redisGet, redisMGet } from "@/app/libs/redis/redis"
import { createProtectComponents } from "@/app/util/protectMessageComponents"
import { ProtectTeamData, ProtectMatchMeta, TeamSide } from "@/app/types/match"
import { getMatchKey } from "@/app/util/redisKeys"

// コマンド初期表示
export const newProtectCommand = async () => {
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
      content: "チームを選択してください",
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
 * 両チーム完了時のEmbedメッセージを生成（3カラムテーブル形式）
 */
function createCompletionEmbed(meta: ProtectMatchMeta, blueTeamData: ProtectTeamData, redTeamData: ProtectTeamData) {
  // 左カラム（項目名）の値を構築
  const leftColumnLines: string[] = []

  // 中央カラム（ブルーチーム）の値を構築
  const blueColumnLines: string[] = []

  // 右カラム（レッドチーム）の値を構築
  const redColumnLines: string[] = []

  // プロテクト行（isProtect が true の場合のみ）
  if (meta.isProtect && blueTeamData.protection_champions && redTeamData.protection_champions) {
    leftColumnLines.push("プロテクト    ")
    blueColumnLines.push(blueTeamData.protection_champions)
    redColumnLines.push(redTeamData.protection_champions)

    // protectとroleの間に改行を入れる
    if (meta.isRoleSelect) {
      leftColumnLines.push("\u200B")
      blueColumnLines.push("\u200B")
      redColumnLines.push("\u200B")
    }
  }

  // ロール行（isRoleSelect が true の場合のみ）
  if (meta.isRoleSelect && blueTeamData.roster && redTeamData.roster) {
    leftColumnLines.push("TOP", "JG", "MID", "ADC", "SUP")
    blueColumnLines.push(blueTeamData.roster.top, blueTeamData.roster.jg, blueTeamData.roster.mid, blueTeamData.roster.adc, blueTeamData.roster.sup)
    redColumnLines.push(redTeamData.roster.top, redTeamData.roster.jg, redTeamData.roster.mid, redTeamData.roster.adc, redTeamData.roster.sup)
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

  return NextResponse.json({
    type: 4,
    data: {
      embeds: [
        {
          title: "✅ 結果発表",
          color: 3447003,
          fields,
        },
      ],
    },
  })
}

// プロテクト・ロール入力 モーダル表示（共通処理）
export const handleOpenModalProtectRole = async (teamSide: TeamSide, matchId: string): Promise<NextResponse> => {
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
          placeholder: "例：モルガナ、メル",
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

  return NextResponse.json({
    type: 9,
    data: {
      custom_id: isBlue ? CLIENT_ACTIONS.REGISTER_BLUE_TEAM : CLIENT_ACTIONS.REGISTER_RED_TEAM,
      title: isBlue ? "ブルーサイド" : "レッドサイド",
      components,
    },
  })
}

// チーム情報の登録処理
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handleRegisterTeam = async (teamSide: TeamSide, matchId: string, data: any) => {
  console.log("handleRegisterTeam by", teamSide, "data:", JSON.stringify(data, null, 2))

  // 1. メタデータ取得
  const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))
  console.log("Meta data retrieved:", JSON.stringify(meta, null, 2))

  if (!meta) {
    console.error("Meta not found for matchId:", matchId)
    return NextResponse.json({
      type: 4,
      data: { content: "エラー: 試合情報が見つかりません", flags: 64 },
    })
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
      return NextResponse.json({
        type: 4,
        data: { content: "エラー: 全てのロールに選手を割り振ってください", flags: 64 },
      })
    }

    // 選択された4人を配列化
    const selectedMembers = [top, jg, mid, adc]

    // 重複チェック
    const uniqueMembers = new Set(selectedMembers)
    if (uniqueMembers.size !== 4) {
      return NextResponse.json({
        type: 4,
        data: { content: "エラー: 同じメンバーが複数のロールに選択されています", flags: 64 },
      })
    }

    // メタデータからメンバー配列を取得
    if (!meta.members) {
      return NextResponse.json({
        type: 4,
        data: { content: "エラー: メンバー情報が見つかりません", flags: 64 },
      })
    }

    const teamMembers = meta.members.redTeam

    // 残り1人をsupとして自動割り当て
    const supMember = teamMembers.find((m) => !selectedMembers.includes(m))
    if (!supMember) {
      return NextResponse.json({
        type: 4,
        data: { content: "エラー: Supportロールに割り当てるメンバーが見つかりません", flags: 64 },
      })
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
    return createCompletionEmbed(meta, otherTeamData!, usTeamData)
  } else {
    console.log(teamSide, "- Returning single team completion message")
    return NextResponse.json({
      type: 4,
      data: { content: teamSide === "blue_team" ? "🟦 ブルーサイド登録完了" : "🟥 レッドサイド登録完了" },
    })
  }
}

// 登録状況確認
export const handleCheckRegistered = async (matchId: string) => {
  // 1. メタデータ取得
  const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))

  if (!meta) {
    return NextResponse.json({
      type: 4,
      data: { content: "エラー: 試合情報が見つかりません", flags: 64 },
    })
  }

  // 2. 両チームデータ一括取得（MGET使用）
  const teamKeys = [getMatchKey(matchId, "red_team"), getMatchKey(matchId, "blue_team")]
  const [redTeamData, blueTeamData] = await redisMGet<ProtectTeamData>(teamKeys)

  // 3. 両チーム完了判定
  const isBothRegistered =
    redTeamData && blueTeamData && (!meta.isProtect || (blueTeamData.protection_champions && redTeamData.protection_champions)) && (!meta.isRoleSelect || (blueTeamData.roster && redTeamData.roster))

  // 4. メッセージ返却
  if (isBothRegistered) {
    // 両チーム完了時はEmbed形式で表示
    return createCompletionEmbed(meta, blueTeamData!, redTeamData!)
  } else if (!redTeamData && !blueTeamData) {
    // 両チーム未登録
    return NextResponse.json({
      type: 4,
      data: { content: "🟦 ブルーサイド：✍️未登録\n🟥 レッドサイド：✍️未登録", flags: 64 },
    })
  } else if (!blueTeamData) {
    // ブルーチームのみ未登録
    return NextResponse.json({
      type: 4,
      data: { content: "🟦 ブルーサイド：✅登録済み\n🟥 レッドサイド：✍️未登録", flags: 64 },
    })
  } else {
    // レッドチームのみ未登録
    return NextResponse.json({
      type: 4,
      data: { content: "🟥 レッドサイド：✅登録済み\n🟦 ブルーサイド：✍️未登録", flags: 64 },
    })
  }
}
