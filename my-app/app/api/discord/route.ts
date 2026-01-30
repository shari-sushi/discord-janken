import { NextRequest, NextResponse } from "next/server"
import { verifyKey } from "discord-interactions"
import { COMMANDS } from "@/app/util/command"
import { echoCommand } from "./route-commands/echo"
import { newId } from "@/app/util/newId"
import { handleRegisterProtectionChamp } from "../web/_handlers/registerProtectionChamp"

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!

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
                type: 1, // Action Row
                components: [
                  {
                    type: 2, // Button
                    style: 4, // Danger (赤)
                    label: "赤チーム",
                    custom_id: `red_team?match_id=${matchId}`,
                  },
                  {
                    type: 2, // Button
                    style: 1, // Primary (青)
                    label: "青チーム",
                    custom_id: `blue_team?match_id=${matchId}`,
                  },
                  {
                    type: 2, // Button
                    style: 2, // Secondary (グレー)
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

    // ボタンクリックなどのコンポーネントインタラクション
    if (interaction.type === 3) {
      const customId = interaction.data.custom_id
      const [teamId, matchIdParam] = customId.split("?")
      const matchId = new URLSearchParams(matchIdParam || "").get("match_id") || ""
      console.log("team:", teamId)

      if (teamId === "red_team") {
        return NextResponse.json({
          type: 9, // モーダル（入力フォーム）を表示
          data: {
            custom_id: "red_team_modal",
            title: "赤チーム",
            components: [
              {
                type: 1, // Action Row
                components: [
                  {
                    type: 4, // Text Input
                    custom_id: `protection_champions?match_id=${matchId}`,
                    label: "メッセージを入力してください",
                    style: 1, // Short (1行)
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
          type: 9, // モーダル（入力フォーム）を表示
          data: {
            custom_id: "blue_team_modal",
            title: "青チーム",
            components: [
              {
                type: 1, // Action Row
                components: [
                  {
                    type: 4, // Text Input
                    custom_id: `protection_champions?match_id=${matchId}`,
                    label: "プロテクトするチャンプを入力",
                    style: 1, // Short (1行)
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
        return NextResponse.json({
          type: 4,
          data: {
            content: "両チーム提出済みか確認中(未実装)",
            flags: 64, // Ephemeral (本人にのみ表示)
          },
        })
      }
    }

    // モーダル送信時の処理
    if (interaction.type === 5) {
      const customId = interaction.data.custom_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const components = interaction.data.components as any[]
      const inputCustomId = components[0]?.components[0]?.custom_id || ""
      const teamText = components[0]?.components[0]?.value || ""
      console.log("customId:", customId, "\ninputCustomId:", inputCustomId, "\nteamText", teamText)

      // Text Inputの custom_id から matchId を抽出
      const matchId = new URLSearchParams(inputCustomId.split("?")[1] || "").get("match_id") || ""
      console.log("matchId", matchId)
      if (customId === "red_team_modal") {
        console.log("Saving red team data for matchId:", matchId)

        // 直接ハンドラーを呼び出す（同期処理）
        await handleRegisterProtectionChamp(req, {
          team: "red",
          match_id: matchId,
          champions: teamText,
          interaction_token: interaction.token,
        })

        console.log("Red team registration completed")

        // DEFERRED レスポンスを返す（Discordに「処理中」を表示）
        return NextResponse.json({
          type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
        })
      }

      if (customId === "blue_team_modal") {
        console.log("Saving blue team data for matchId:", matchId)

        // Web APIを呼び出す（リクエストを開始）
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${req.headers.get("host")}`
        const apiCall = fetch(`${baseUrl}/api/web/registerProtectionChamp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.WEB_API_SECRET && {
              Authorization: `Bearer ${process.env.WEB_API_SECRET}`,
            }),
          },
          body: JSON.stringify({
            team: "blue",
            match_id: matchId,
            champions: teamText,
            interaction_token: interaction.token,
          }),
        })
          .then(() => console.log("Web API completed for blue team"))
          .catch((err) => console.error("Web API error:", err))

        console.log("Web API call initiated for blue team")

        // レスポンスを返した後も処理を継続
        if ("waitUntil" in req) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(req as any).waitUntil(apiCall)
        }

        // DEFERRED レスポンスを返す（Discordに「処理中」を表示）
        return NextResponse.json({
          type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
        })
      }
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
