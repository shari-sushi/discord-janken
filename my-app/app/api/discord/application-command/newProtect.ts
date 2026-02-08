import { CLIENT_ACTIONS } from "@/app/util/commands"
import { newId } from "@/app/util/newId"
import { NextResponse } from "next/server"
import { redisSet, redisGet } from "@/app/libs/redis/redis"

// チームデータを保存し、相手チームのデータを確認する
const saveTeamAndCheckOther = async (matchId: string, team: "red" | "blue", text: string): Promise<{ otherTeamText: string | null; myText: string }> => {
  const myKey = `protect:${matchId}:${team}_team`
  const otherKey = `protect:${matchId}:${team === "red" ? "blue" : "red"}_team`

  await redisSet(myKey, text)
  const otherTeamText = await redisGet<string>(otherKey)

  return { otherTeamText, myText: text }
}

// コマンド初期表示
export const newProtectCommand = () => {
  const matchId = newId()

  return NextResponse.json({
    type: 4,
    data: {
      content: "チームを選択してください",
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: "青チーム",
              custom_id: CLIENT_ACTIONS.OPEN_MODAL_BLUE_TEAM_REGISTER + `?match_id=${matchId}`,
            },
            {
              type: 2,
              style: 4,
              label: "赤チーム",
              custom_id: CLIENT_ACTIONS.OPEN_MODAL_RED_TEAM_REGISTER + `?match_id=${matchId}`,
            },
            {
              type: 2,
              style: 2,
              label: "確認",
              custom_id: CLIENT_ACTIONS.CHECK_REGISTERED + `?match_id=${matchId}`,
            },
          ],
        },
      ],
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
              placeholder: "例：モルガナ、メル、ニーコ",
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
              placeholder: "例：ヴェルコズ、ザック、ダイアナ",
            },
          ],
        },
      ],
    },
  })
}

// レッドチーム 登録処理
export const handleRegisterRedTeam = async (matchId: string, teamText: string) => {
  const { otherTeamText, myText } = await saveTeamAndCheckOther(matchId, "red", teamText)
  const message = otherTeamText ? `🔵 ブルーサイド: ${otherTeamText}\n🔴 レッドサイド: ${myText}` : "🔴 レッドサイド登録完了"
  return NextResponse.json({
    type: 4,
    data: { content: message },
  })
}

// ブルーチーム 登録処理
export const handleRegisterBlueTeam = async (matchId: string, teamText: string) => {
  const { otherTeamText, myText } = await saveTeamAndCheckOther(matchId, "blue", teamText)
  const message = otherTeamText ? `🔵 ブルーサイド: ${myText}\n🔴 レッドサイド: ${otherTeamText}` : "🔵 ブルーサイド登録完了"
  return NextResponse.json({
    type: 4,
    data: { content: message },
  })
}

// 登録状況確認
export const handleCheckRegistered = async (matchId: string) => {
  const redTeamText = await redisGet<string>(`protect:${matchId}:red_team`)
  const blueTeamText = await redisGet<string>(`protect:${matchId}:blue_team`)

  let message: string
  if (redTeamText && blueTeamText) {
    message = `✅ 両チーム登録済み\n🔵 ブルーサイド: ${blueTeamText}\n🔴 レッドサイド: ${redTeamText}`
  } else if (redTeamText) {
    message = "🔵 ブルーサイド: 未登録\n🔴 レッドサイド: 登録済み"
  } else if (blueTeamText) {
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
