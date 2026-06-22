import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teams, teamShares } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, getTeamMembershipWithSuspension } from "@/app/_domains/teamSchedules/_server/authz"
import { hasAdminAuthority } from "@/app/_domains/teamSchedules/types"
import { orderPair, type SharePayload } from "@/app/_domains/teamSchedules/_server/shares"
import { shareKey } from "@/app/_domains/teamSchedules/_server/redisKeys"
import { isUuid } from "@/app/_domains/teamSchedules/_server/validators"
import { redisGet } from "@/app/_server/lib/redis/redis"

/**
 * POST /api/web/team-schedules/shares
 * 共有リンクを受諾し、自分の所属チーム（acceptTeamId）と発行元チームを相互共有する（#175）。
 * 要ログイン + suspend不可 + acceptTeam の admin。body: { token, acceptTeamId }
 *
 * 共有は複数人で使う想定はないが、招待と同じく受諾後もトークンは削除しない（TTLで失効）。
 * 既に共有済みなら何もしない（冪等・PK + onConflictDoNothing）。
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as { token?: unknown; acceptTeamId?: unknown } | null
    const token = body?.token
    const acceptTeamId = body?.acceptTeamId
    if (typeof token !== "string" || !token || !isUuid(acceptTeamId)) {
      return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
    }

    // 利用停止判定と acceptTeam のロール取得を1クエリに（suspend→403 を先に）
    const { suspended, teamRole } = await getTeamMembershipWithSuspension(acceptTeamId, userId)
    if (suspended) {
      return NextResponse.json({ success: false, error: "アカウントが利用停止中のため、この操作はできません" }, { status: 403 })
    }
    // acceptTeam の admin 以上でなければ存在を隠して 404
    if (teamRole === null || !hasAdminAuthority(teamRole)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    const payload = await redisGet<SharePayload>(shareKey(token))
    if (!payload) {
      return NextResponse.json({ success: false, error: "共有リンクの有効期限が切れているか、無効です" }, { status: 401 })
    }
    const { sourceTeamId } = payload

    // 自己共有は不可（team_low<team_high の CHECK でも弾けるが、明示的に 400 を返す）
    if (sourceTeamId === acceptTeamId) {
      return NextResponse.json({ success: false, error: "同じチーム同士は共有できません" }, { status: 400 })
    }

    // 発行元チームが解散済み等で存在しないなら受諾できない
    const sourceRows = await db.select({ teamId: teams.teamId }).from(teams).where(eq(teams.teamId, sourceTeamId)).limit(1)
    if (!sourceRows[0]) {
      return NextResponse.json({ success: false, error: "共有元のチームが見つかりません" }, { status: 404 })
    }

    const { teamLow, teamHigh } = orderPair(sourceTeamId, acceptTeamId)
    await db
      .insert(teamShares)
      .values({ teamLow, teamHigh, createdBy: userId })
      .onConflictDoNothing({ target: [teamShares.teamLow, teamShares.teamHigh] })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules shares POST error:", error)
    return NextResponse.json({ success: false, error: "スケジュール共有の開始に失敗しました" }, { status: 500 })
  }
}
