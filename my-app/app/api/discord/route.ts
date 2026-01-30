import { NextRequest, NextResponse } from "next/server"
import { verifyKey } from "discord-interactions"

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

      if (name === "same-say-echo") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = options?.find((opt: any) => opt.name === "text")?.value || ""

        // チャンネルにメッセージとして投稿（ephemeralフラグを外す）
        return NextResponse.json({
          type: 4,
          data: {
            content: text,
          },
        })
      }

      if (name === "same-say-new-protect") {
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
                    custom_id: "red_team",
                  },
                  {
                    type: 2, // Button
                    style: 1, // Primary (青)
                    label: "青チーム",
                    custom_id: "blue_team",
                  },
                  {
                    type: 2, // Button
                    style: 2, // Secondary (グレー)
                    label: "確認",
                    custom_id: "confirm",
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

      if (customId === "red_team") {
        // モーダル（入力フォーム）を表示
        return NextResponse.json({
          type: 9, // MODAL
          data: {
            custom_id: "red_team_modal",
            title: "赤チーム",
            components: [
              {
                type: 1, // Action Row
                components: [
                  {
                    type: 4, // Text Input
                    custom_id: "team_text",
                    label: "メッセージを入力してください",
                    style: 1, // Short (1行)
                    required: true,
                    placeholder: "プロテクト内容を入力",
                  },
                ],
              },
            ],
          },
        })
      }

      if (customId === "blue_team") {
        // モーダル（入力フォーム）を表示
        return NextResponse.json({
          type: 9, // MODAL
          data: {
            custom_id: "blue_team_modal",
            title: "青チーム",
            components: [
              {
                type: 1, // Action Row
                components: [
                  {
                    type: 4, // Text Input
                    custom_id: "team_text",
                    label: "メッセージを入力してください",
                    style: 1, // Short (1行)
                    required: true,
                    placeholder: "プロテクト内容を入力",
                  },
                ],
              },
            ],
          },
        })
      }

      if (customId === "confirm") {
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
      const teamText = components[0]?.components[0]?.value || ""

      if (customId === "red_team_modal") {
        return NextResponse.json({
          type: 4,
          data: {
            content: `赤チーム: ${teamText}`,
          },
        })
      }

      if (customId === "blue_team_modal") {
        return NextResponse.json({
          type: 4,
          data: {
            content: `青チーム: ${teamText}`,
          },
        })
      }
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
