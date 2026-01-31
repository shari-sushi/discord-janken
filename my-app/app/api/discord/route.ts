import { NextRequest, NextResponse } from "next/server"
import { verifyKey } from "discord-interactions"
import { COMMANDS } from "@/app/util/command"
import { echoCommand } from "./route-commands/echo"
import { newId } from "@/app/util/newId"
import { redisSet, redisGet } from "@/app/libs/redis/redis"

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!

// チームデータを保存し、相手チームのデータを確認する
const saveTeamAndCheckOther = async (matchId: string, team: "red" | "blue", text: string): Promise<{ otherTeamText: string | null; myText: string }> => {
  const myKey = `protect:${matchId}:${team}_team`
  const otherKey = `protect:${matchId}:${team === "red" ? "blue" : "red"}_team`

  await redisSet(myKey, text)
  const otherTeamText = await redisGet<string>(otherKey)

  return { otherTeamText, myText: text }
}

export async function POST(req: NextRequest) {
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

    if (interaction.type === 1) {
      console.log("Sending PONG")
      return NextResponse.json({ type: 1 })
    }

    if (interaction.type === 2) {
      const { name, options } = interaction.data
      console.log("command:", name)

      if (name === COMMANDS.ECHO) {
        return echoCommand(options)
      }

      if (name === COMMANDS.NEW_PROTECT) {
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
                    style: 4,
                    label: "赤チーム",
                    custom_id: `red_team?match_id=${matchId}`,
                  },
                  {
                    type: 2,
                    style: 1,
                    label: "青チーム",
                    custom_id: `blue_team?match_id=${matchId}`,
                  },
                  {
                    type: 2,
                    style: 2,
                    label: "確認",
                    custom_id: `check?match_id=${matchId}`,
                  },
                ],
              },
            ],
          },
        })
      }
    }

    // ボタンクリック
    if (interaction.type === 3) {
      const customId = interaction.data.custom_id
      const [teamId, matchIdParam] = customId.split("?")
      const matchId = new URLSearchParams(matchIdParam || "").get("match_id") || ""
      console.log("team:", teamId)

      if (teamId === "red_team") {
        return NextResponse.json({
          type: 9,
          data: {
            custom_id: "red_team_modal",
            title: "赤チーム",
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

      if (teamId === "blue_team") {
        return NextResponse.json({
          type: 9,
          data: {
            custom_id: "blue_team_modal",
            title: "青チーム",
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

      if (teamId === "check") {
        const redTeamText = await redisGet<string>(`protect:${matchId}:red_team`)
        const blueTeamText = await redisGet<string>(`protect:${matchId}:blue_team`)

        let message: string
        if (redTeamText && blueTeamText) {
          message = `✅ 両チーム登録済み\n🔴 赤チーム: ${redTeamText}\n🔵 青チーム: ${blueTeamText}`
        } else if (redTeamText) {
          message = "🔴 赤チーム: 登録済み\n🔵 青チーム: 未登録"
        } else if (blueTeamText) {
          message = "🔴 赤チーム: 未登録\n🔵 青チーム: 登録済み"
        } else {
          message = "🔴 赤チーム: 未登録\n🔵 青チーム: 未登録"
        }

        return NextResponse.json({
          type: 4,
          data: {
            content: message,
          },
        })
      }
    }

    // モーダル送信
    if (interaction.type === 5) {
      const customId = interaction.data.custom_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const components = interaction.data.components as any[]
      const inputCustomId = components[0]?.components[0]?.custom_id || ""
      const teamText = components[0]?.components[0]?.value || ""
      const matchId = new URLSearchParams(inputCustomId.split("?")[1] || "").get("match_id") || ""

      console.log("customId:", customId, "matchId:", matchId, "teamText:", teamText)

      if (customId === "red_team_modal") {
        const { otherTeamText, myText } = await saveTeamAndCheckOther(matchId, "red", teamText)
        const message = otherTeamText ? `🔴 赤チーム: ${myText}\n🔵 青チーム: ${otherTeamText}` : "🔴 赤チーム登録完了"

        return NextResponse.json({
          type: 4,
          data: { content: message },
        })
      }

      if (customId === "blue_team_modal") {
        const { otherTeamText, myText } = await saveTeamAndCheckOther(matchId, "blue", teamText)
        const message = otherTeamText ? `🔴 赤チーム: ${otherTeamText}\n🔵 青チーム: ${myText}` : "🔵 青チーム登録完了"

        return NextResponse.json({
          type: 4,
          data: { content: message },
        })
      }
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
