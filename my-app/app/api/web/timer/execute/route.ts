import { Receiver } from "@upstash/qstash"
import { NextRequest, NextResponse } from "next/server"

interface TimerPayload {
  channelId: string
  message: string
  guildId: string
  createdBy: string
}

export async function POST(req: NextRequest) {
  try {
    // QStash署名検証
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
    })

    const signature = req.headers.get("upstash-signature")
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 })
    }

    const body = await req.text()

    // 署名検証
    const isValid = await receiver
      .verify({
        signature,
        body,
      })
      .catch(() => false)

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // ペイロードをパース
    const payload: TimerPayload = JSON.parse(body)

    // Discord Webhookでメッセージ送信
    const webhookUrl = `https://discord.com/api/v10/channels/${payload.channelId}/messages`

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: `⏰ ${payload.message}\n\n（<@${payload.createdBy}>さんが設定）`,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Discord API error:", errorText)
      return NextResponse.json(
        { error: "Failed to send Discord message" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Timer execute error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
