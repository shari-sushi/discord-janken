import { kv } from "@vercel/kv"
import { NextRequest, NextResponse } from "next/server"

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL!

interface Game {
  messages: Record<string, string>; // { userId: message }
  createdAt: number;
}

export async function POST(req: NextRequest) {
  try {
    const { gameId, userId, message } = await req.json()

    // バリデーション
    if (!gameId || !userId || !message) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const key = `game:${gameId}`

    // 既存ゲーム取得
    let game = await kv.get<Game>(key)

    if (!game) {
      // 新規ゲーム作成
      game = {
        messages: { [userId]: message },
        createdAt: Date.now(),
      }
      await kv.set(key, game, { ex: 600 }) // 10分で自動削除

      return NextResponse.json({
        status: "waiting",
        message: "相手の発言を待っています",
      })
    }

    // 同じユーザーが2回提出しようとした場合
    if (game.messages[userId]) {
      return NextResponse.json(
        {
          error: "Already submitted",
        },
        { status: 400 },
      )
    }

    // メッセージを追加
    game.messages[userId] = message

    // 両方揃ったか確認
    const players = Object.keys(game.messages)

    if (players.length === 2) {
      // Discord通知
      const [p1, p2] = players
      await sendDiscordNotification(p1, p2, game.messages[p1], game.messages[p2])

      // ゲーム削除
      await kv.del(key)

      return NextResponse.json({
        status: "finished",
        messages: game.messages,
      })
    }

    // まだ1人しか提出してない
    await kv.set(key, game, { ex: 600 })

    return NextResponse.json({
      status: "waiting",
      message: "相手の発言を待っています",
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

async function sendDiscordNotification(player1: string, player2: string, message1: string, message2: string) {
  await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "💬 同時発言",
          fields: [
            { name: `<@${player1}>`, value: message1, inline: false },
            { name: `<@${player2}>`, value: message2, inline: false },
          ],
          color: 0x5865f2,
        },
      ],
    }),
  })
}
