import { NextRequest, NextResponse } from "next/server"
import { addDiscordBan, listDiscordBans } from "@/app/_domains/teamSchedules/_server/bans"
import type { AdminDiscordBan } from "@/app/_domains/teamSchedules/types"
import { requireAdmin } from "../_auth"

/** Discord snowflake（数字のみ・17〜20桁が一般的）。経路バリデーション用に少し緩めに見る */
const isDiscordId = (value: unknown): value is string => typeof value === "string" && /^\d{15,21}$/.test(value)
const REASON_MAX_LENGTH = 500

/**
 * GET /api/web/team-schedules/admin/discord-bans
 * BAN 済み Discord ID の一覧を返す（要 admin・新しい順）。
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const rows = await listDiscordBans()
    const bans: AdminDiscordBan[] = rows.map((b) => ({ discordUserId: b.discordUserId, reason: b.reason, bannedAt: b.bannedAt.toISOString() }))
    return NextResponse.json({ success: true, bans })
  } catch (error) {
    console.error("team-schedules admin discord-bans GET error:", error)
    return NextResponse.json({ success: false, error: "BAN 一覧の取得に失敗しました" }, { status: 500 })
  }
}

/**
 * POST /api/web/team-schedules/admin/discord-bans
 * Discord ID を BAN に追加する（要 admin）。body: { discordUserId, reason? }
 *
 * ↓注意: BAN は auth/verify（新規ログイン）でのみ判定する。既に ts_session を持つユーザーは
 *        最大30日のセッションが残るため即時ログアウトされない（利用者側の即時失効は将来対応）。
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const body = (await req.json().catch(() => null)) as { discordUserId?: unknown; reason?: unknown } | null
    if (!body || !isDiscordId(body.discordUserId)) {
      return NextResponse.json({ success: false, error: "Discord ID（数字のみ）を入力してください" }, { status: 400 })
    }
    if (body.reason !== undefined && body.reason !== null && (typeof body.reason !== "string" || body.reason.length > REASON_MAX_LENGTH)) {
      return NextResponse.json({ success: false, error: "理由は500文字以内で入力してください" }, { status: 400 })
    }
    const reason = typeof body.reason === "string" && body.reason.trim() !== "" ? body.reason.trim() : null

    const ban = await addDiscordBan(body.discordUserId, reason)
    const result: AdminDiscordBan = { discordUserId: ban.discordUserId, reason: ban.reason, bannedAt: ban.bannedAt.toISOString() }
    return NextResponse.json({ success: true, ban: result })
  } catch (error) {
    console.error("team-schedules admin discord-bans POST error:", error)
    return NextResponse.json({ success: false, error: "BAN の追加に失敗しました" }, { status: 500 })
  }
}
