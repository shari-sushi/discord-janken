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
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
