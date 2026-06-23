import { Receiver } from "@upstash/qstash"
import { NextRequest, NextResponse } from "next/server"
import { QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY } from "@/app/_server/lib/env"
import { sendActivityReachedNow } from "@/app/_domains/teamSchedules/_server/notify"
import { isDayKey, isUuid } from "@/app/_domains/teamSchedules/_server/validators"

/**
 * POST /api/web/team-schedules/notify/execute
 *
 * 時刻指定の活動可能通知（#177）の発火コールバック。QStash が予約時刻に叩く。
 * 認証は QStash 署名検証（upstash-signature）のみ。ペイロードは { teamId, day }。
 * 送信本体（sendActivityReachedNow）が発火時に活動可能か再判定し、まだ達成なら送る
 * （条件割れ・設定OFF・Webhook 未登録はそこで吸収して no-op になる）。
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const receiver = new Receiver({
      currentSigningKey: QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: QSTASH_NEXT_SIGNING_KEY,
    })

    const signature = req.headers.get("upstash-signature")
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 })
    }

    const body = await req.text()
    const isValid = await receiver.verify({ signature, body }).catch(() => false)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const payload = JSON.parse(body) as { teamId?: unknown; day?: unknown }
    if (!isUuid(payload.teamId) || !isDayKey(payload.day)) {
      // 不正ペイロードはリトライさせない（200 で握る）
      console.error("team-schedules notify/execute: 不正なペイロード", payload)
      return NextResponse.json({ success: true, skipped: true })
    }

    // 発火時に再判定して送る（達成していなければ内部で no-op）。失敗してもログのみ
    await sendActivityReachedNow(payload.teamId, payload.day)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules notify/execute error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
