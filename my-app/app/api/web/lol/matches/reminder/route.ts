import { Receiver } from "@upstash/qstash"
import { NextRequest, NextResponse } from "next/server"
import { redisGet } from "@/app/libs/redis/redis"
import { sendDiscordMessage } from "@/app/libs/discord/api"
import { getMatchKey } from "@/app/util/redisKeys"
import { ProtectTeamData } from "@/app/types/match"

interface ReminderPayload {
  matchId: string
  channelId: string
  guildId: string
  message: string
}

// リマインダーの通知タイミングで使われるapi。通常は人が直接使うことは無い。
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

    const isValid = await receiver
      .verify({
        signature,
        body,
      })
      .catch(() => false)

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const payload: ReminderPayload = JSON.parse(body)
    const { matchId, channelId, message } = payload

    // Redisから各チームのデータ確認
    const [redTeamData, blueTeamData] = await Promise.all([redisGet<ProtectTeamData>(getMatchKey(matchId, "red_team")), redisGet<ProtectTeamData>(getMatchKey(matchId, "blue_team"))])

    // 未記入チームを収集
    const unregisteredTeams: string[] = []
    if (!blueTeamData) unregisteredTeams.push("🟦 ブルーサイド")
    if (!redTeamData) unregisteredTeams.push("🟥 レッドサイド")

    // 両チームが記入済みの場合は何もしない
    if (unregisteredTeams.length === 0) {
      return NextResponse.json({ success: true, message: "Both teams registered" })
    }

    // 未記入チームへの通知
    const teamReminders = unregisteredTeams.map((team) => `⚠️ ${team}は未記入‼️`).join("\n")
    await sendDiscordMessage(channelId, `${teamReminders}\n\n⚠️ ${message}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Match reminder error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
