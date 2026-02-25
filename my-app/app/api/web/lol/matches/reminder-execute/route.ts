import { Receiver } from "@upstash/qstash"
import { NextRequest, NextResponse } from "next/server"
import { redisGet, redisMGet } from "@/app/_server/lib/redis/redis"
import { getMatchKey } from "@/app/_server/util/redisKeys"
import { ProtectTeamData, ProtectMatchMeta } from "@/app/types/match"
import { getMatchStatusMessage } from "@/app/api/discord/command/lol/newMatch"

interface ReminderPayload {
  matchId: string
  channelId: string
  guildId: string
  message?: string
  createdBy?: string
}

interface DiscordMessageRequestBody {
  content: string
  embeds?: Array<{
    title?: string
    color?: number
    fields?: Array<{ name: string; value: string; inline: boolean }>
  }>
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
    const { matchId, channelId } = payload

    // 1. メタデータ取得
    const meta = await redisGet<ProtectMatchMeta>(getMatchKey(matchId, "meta"))
    if (!meta) {
      console.error("Match metadata not found for matchId:", matchId)
      return NextResponse.json({ error: "Match metadata not found" }, { status: 404 })
    }

    // 2. 両チームデータ一括取得（MGET使用）
    const teamKeys = [getMatchKey(matchId, "blue_team"), getMatchKey(matchId, "red_team")]
    const [blueTeamData, redTeamData] = await redisMGet<ProtectTeamData>(teamKeys)

    // 3. 両チーム完了判定
    const isBothRegistered =
      redTeamData && blueTeamData && (!meta.isProtect || (blueTeamData.protection_champions && redTeamData.protection_champions)) && (!meta.isRoleSelect || (blueTeamData.roster && redTeamData.roster))

    // 両チームが記入済みの場合は何もしない
    if (isBothRegistered) {
      return NextResponse.json({ success: true, message: "Both teams registered" })
    }

    // 4. 試合の現在状況を取得
    const matchStatusData = await getMatchStatusMessage(matchId)
    if (!matchStatusData) {
      console.error("Match status data could not be generated for matchId:", matchId)
      return NextResponse.json({ error: "Match status data not found" }, { status: 404 })
    }

    // 5. メッセージを構築
    let messageContent = `⏰ タイマーが作動しました\n`
    if (payload.message) {
      messageContent += `メッセージ：${payload.message}\n`
    } else {
      messageContent += `メッセージ：無し\n`
    }

    if (payload.createdBy) {
      messageContent += `（<@${payload.createdBy}>さんが設定）`
    }

    // 試合の現在状況を追加
    if (matchStatusData.content) {
      messageContent += `\n\n${matchStatusData.content}`
    }

    // 6. Discord Webhookでメッセージ送信
    const webhookUrl = `https://discord.com/api/v10/channels/${channelId}/messages`

    const requestBody: DiscordMessageRequestBody = {
      content: messageContent,
    }

    // Embed がある場合は追加
    if (matchStatusData?.embeds) {
      requestBody.embeds = matchStatusData.embeds
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Discord API error:", errorText)
      return NextResponse.json({ error: "Failed to send Discord message" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Match reminder error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
