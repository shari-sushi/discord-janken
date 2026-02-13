import { CLIENT_ACTIONS } from "@/app/util/commands"
import { newId } from "@/app/util/newId"
import { NextResponse } from "next/server"
import { redisSet, redisGet, redisMGet } from "@/app/libs/redis/redis"
import { createProtectComponents } from "@/app/util/protectMessageComponents"
import { ProtectTeamData, ProtectMatchMeta } from "@/app/types/match"
import { getMatchKey } from "@/app/util/redisKeys"

// チームデータを保存し、相手チームのデータを確認する
const saveTeamAndCheckOther = async (matchId: string, team: "red" | "blue", text: string): Promise<{ otherTeamData: ProtectTeamData | null; myData: ProtectTeamData }> => {
  const myKey = getMatchKey(matchId, `${team}_team`)
  const otherKey = getMatchKey(matchId, team === "red" ? "blue_team" : "red_team")

  // 自チームのデータを作成・保存
  const myData: ProtectTeamData = {
    protection_champions: text,
    updated_at: new Date().toISOString(),
  }
  await redisSet(myKey, myData)

  // 相手チームのデータを取得
  const otherTeamData = await redisGet<ProtectTeamData>(otherKey)

  return { otherTeamData, myData }
}

// コマンド初期表示
export const newProtectCommand = async () => {
  const matchId = newId()

  // メタデータを作成・保存
  const meta: ProtectMatchMeta = {
    match_id: matchId,
    created_at: new Date().toISOString(),
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

// レッドチーム モーダル表示
export const handleOpenModalRedTeam = (matchId: string) => {
  return NextResponse.json({
    type: 9,
    data: {
      custom_id: CLIENT_ACTIONS.REGISTER_RED_TEAM,
      title: "レッドサイド",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: `protection_champions?match_id=${matchId}`,
              label: "メッセージを入力してください",
              style: 1,
              required: true,
              placeholder: "例：モルガナ、メル",
            },
          ],
        },
      ],
    },
  })
}

// ブルーチーム モーダル表示
export const handleOpenModalBlueTeam = (matchId: string) => {
  return NextResponse.json({
    type: 9,
    data: {
      custom_id: CLIENT_ACTIONS.REGISTER_BLUE_TEAM,
      title: "ブルーサイド",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: `protection_champions?match_id=${matchId}`,
              label: "プロテクトするチャンプを入力",
              style: 1,
              required: true,
              placeholder: "例：ヴェルコズ、ザック",
            },
          ],
        },
      ],
    },
  })
}

// レッドチーム 登録処理
export const handleRegisterRedTeam = async (matchId: string, teamText: string) => {
  const { otherTeamData, myData } = await saveTeamAndCheckOther(matchId, "red", teamText)
  const message = otherTeamData ? `🔵 ブルーサイド: ${otherTeamData.protection_champions}\n🔴 レッドサイド: ${myData.protection_champions}` : "🔴 レッドサイド登録完了"
  return NextResponse.json({
    type: 4,
    data: { content: message },
  })
}

// ブルーチーム 登録処理
export const handleRegisterBlueTeam = async (matchId: string, teamText: string) => {
  const { otherTeamData, myData } = await saveTeamAndCheckOther(matchId, "blue", teamText)
  const message = otherTeamData ? `🔵 ブルーサイド: ${myData.protection_champions}\n🔴 レッドサイド: ${otherTeamData.protection_champions}` : "🔵 ブルーサイド登録完了"
  return NextResponse.json({
    type: 4,
    data: { content: message },
  })
}

// 登録状況確認
export const handleCheckRegistered = async (matchId: string) => {
  const redTeamKey = getMatchKey(matchId, "red_team")
  const blueTeamKey = getMatchKey(matchId, "blue_team")

  // 一括取得（MGET使用）
  const [redTeamData, blueTeamData] = await redisMGet<ProtectTeamData>([
    redTeamKey,
    blueTeamKey,
  ])

  let message: string
  if (redTeamData && blueTeamData) {
    message = `✅ 両チーム登録済み\n🔵 ブルーサイド: ${blueTeamData.protection_champions}\n🔴 レッドサイド: ${redTeamData.protection_champions}`
  } else if (redTeamData) {
    message = "🔵 ブルーサイド: 未登録\n🔴 レッドサイド: 登録済み"
  } else if (blueTeamData) {
    message = "🔵 ブルーサイド: 登録済み\n🔴 レッドサイド: 未登録"
  } else {
    message = "🔵 ブルーサイド: 未登録\n🔴 レッドサイド: 未登録"
  }

  return NextResponse.json({
    type: 4,
    data: {
      content: message,
    },
  })
}
