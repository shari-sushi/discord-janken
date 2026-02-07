import { NextRequest, NextResponse } from "next/server"
import { verifyKey } from "discord-interactions"
import { echoCommand } from "./application-command/echo"
import { newProtectCommand } from "./application-command/newProtect"
import { feedbackCommand } from "./application-command/feedback"
import { redisSet, redisGet } from "@/app/libs/redis/redis"
import { appendFeedbackToSheet } from "@/app/libs/googleSheets"
import { CLIENT_ACTIONS, COMMANDS, DISCORD_INTERACTION_TYPE } from "@/app/util/commands"

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

    // PING
    if (interaction.type === DISCORD_INTERACTION_TYPE.PING) {
      return NextResponse.json({ type: 1 })
    }

    // discord-botのコマンド
    if (interaction.type === DISCORD_INTERACTION_TYPE.APPLICATION_COMMAND) {
      const { name: commandName, options } = interaction.data
      console.log("command:", commandName)

      switch (commandName) {
        case COMMANDS.ECHO:
          return echoCommand(options)
        case COMMANDS.NEW_PROTECT:
          return newProtectCommand()
        case COMMANDS.FEEDBACK:
          return feedbackCommand()
        default:
          return NextResponse.json({
            type: 4,
            data: {
              content: "不明なコマンドです" + commandName,
            },
          })
      }
    }

    // ボタン押された時とか
    if (interaction.type === DISCORD_INTERACTION_TYPE.MESSAGE_COMPONENT) {
      const customId = interaction.data.custom_id
      const [teamId, matchIdParam] = customId.split("?")
      const matchId = new URLSearchParams(matchIdParam || "").get("match_id") || ""
      console.log("team:", teamId)

      switch (teamId) {
        case CLIENT_ACTIONS.OPEN_MODAL_RED_TEAM_REGISTER:
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

        case CLIENT_ACTIONS.OPEN_MODAL_BLUE_TEAM_REGISTER:
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

        case CLIENT_ACTIONS.SELECT_FEEDBACK_TYPE:
          // Selectメニューから選択されたフィードバックの種類を取得
          const selectedType = interaction.data.values?.[0] || ""
          return NextResponse.json({
            type: 9, // モーダルを開く
            data: {
              custom_id: `${CLIENT_ACTIONS.SUBMIT_FEEDBACK}?type=${selectedType}`,
              title: "フィードバック",
              components: [
                {
                  type: 1,
                  components: [
                    {
                      type: 4,
                      custom_id: "feedback_name",
                      label: "お名前（任意）",
                      style: 1, // 短いテキスト
                      required: false,
                      placeholder: "例：太郎",
                    },
                  ],
                },
                {
                  type: 1,
                  components: [
                    {
                      type: 4,
                      custom_id: "feedback_content",
                      label: "内容（必須）",
                      style: 2, // 長いテキスト（パラグラフ）
                      required: true,
                      placeholder: "フィードバック内容を入力してください",
                    },
                  ],
                },
              ],
            },
          })

        case CLIENT_ACTIONS.CHECK_REGISTERED:
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

        default:
          return NextResponse.json({
            type: 4,
            data: {
              content: "不明な操作です" + teamId,
            },
          })
      }
    }

    // モーダルで送信したとき
    if (interaction.type === DISCORD_INTERACTION_TYPE.MODAL_SUBMIT) {
      const customId = interaction.data.custom_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const components = interaction.data.components as any[]

      if (customId.startsWith(CLIENT_ACTIONS.SUBMIT_FEEDBACK)) {
        // フィードバック送信処理
        // custom_idからフィードバックの種類を取得
        const customIdParams = new URLSearchParams(customId.split("?")[1] || "")
        const type = customIdParams.get("type") || ""

        // componentsからお名前と内容を取得
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const name = components.find((c: any) => c.components[0]?.custom_id === "feedback_name")?.components[0]?.value || ""
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content = components.find((c: any) => c.components[0]?.custom_id === "feedback_content")?.components[0]?.value || ""

        const guildId = interaction.guild_id || ""
        const memberId = interaction.member?.user?.id || interaction.user?.id || ""

        try {
          await appendFeedbackToSheet({
            guildId,
            memberId,
            name,
            type,
            content,
          })

          return NextResponse.json({
            type: 4,
            data: {
              content: "フィードバックを送信しました。ありがとうございます！",
              flags: 64, // EPHEMERAL - 送信者のみに表示
            },
          })
        } catch (error) {
          console.error("Error submitting feedback:", error)
          return NextResponse.json({
            type: 4,
            data: {
              content: "フィードバックの送信に失敗しました。もう一度お試しください。",
              flags: 64, // EPHEMERAL
            },
          })
        }
      }

      const inputCustomId = components[0]?.components[0]?.custom_id || ""
      const teamText = components[0]?.components[0]?.value || ""
      const matchId = new URLSearchParams(inputCustomId.split("?")[1] || "").get("match_id") || ""

      if (customId === CLIENT_ACTIONS.REGISTER_RED_TEAM) {
        const { otherTeamText, myText } = await saveTeamAndCheckOther(matchId, "red", teamText)
        const message = otherTeamText ? `🔵 ブルーサイド: ${otherTeamText}\n🔴 レッドサイド: ${myText}` : "🔴 レッドサイド登録完了"
        return NextResponse.json({
          type: 4,
          data: { content: message },
        })
      }

      if (customId === CLIENT_ACTIONS.REGISTER_BLUE_TEAM) {
        const { otherTeamText, myText } = await saveTeamAndCheckOther(matchId, "blue", teamText)
        const message = otherTeamText ? `🔵 ブルーサイド: ${myText}\n🔴 レッドサイド: ${otherTeamText}` : "🔵 ブルーサイド登録完了"
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
