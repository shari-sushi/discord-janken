import { and, eq, inArray, ne } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teamMembers, teams } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId } from "@/app/_domains/teamSchedules/_server/authz"
import { shareKey } from "@/app/_domains/teamSchedules/_server/redisKeys"
import type { SharePayload } from "@/app/_domains/teamSchedules/_server/shares"
import { redisGet } from "@/app/_server/lib/redis/redis"
import type { SharePreview } from "@/app/_domains/teamSchedules/types"

/**
 * GET /api/web/team-schedules/shares/preview?token=
 * 共有リンク着地時の確認画面用情報を返す（要ログイン・#175）。
 * - sourceTeam: リンク発行元チーム
 * - acceptCandidates: 受諾者が admin 以上で結べる自分の所属チーム（sourceTeam 自身は除外）
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 })
    }

    const token = req.nextUrl.searchParams.get("token")
    if (!token) {
      return NextResponse.json({ success: false, error: "共有リンクが不正です" }, { status: 400 })
    }

    const payload = await redisGet<SharePayload>(shareKey(token))
    if (!payload) {
      return NextResponse.json({ success: false, error: "共有リンクの有効期限が切れているか、無効です" }, { status: 401 })
    }
    const { sourceTeamId } = payload

    const sourceRows = await db.select({ teamId: teams.teamId, name: teams.name }).from(teams).where(eq(teams.teamId, sourceTeamId)).limit(1)
    const sourceTeam = sourceRows[0]
    if (!sourceTeam) {
      // 発行元チームが解散済み等
      return NextResponse.json({ success: false, error: "共有元のチームが見つかりません" }, { status: 404 })
    }

    // 受諾者が admin 以上で所属するチーム（sourceTeam 自身は除外＝自己共有を候補から外す）
    const candidateRows = await db
      .select({ teamId: teams.teamId, name: teams.name })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.teamId, teamMembers.teamId))
      .where(and(eq(teamMembers.userId, userId), inArray(teamMembers.teamRole, ["master", "admin"]), ne(teamMembers.teamId, sourceTeamId)))

    const preview: SharePreview = { sourceTeam, acceptCandidates: candidateRows }
    return NextResponse.json({ success: true, preview })
  } catch (error) {
    console.error("team-schedules shares preview GET error:", error)
    return NextResponse.json({ success: false, error: "共有リンクの確認に失敗しました" }, { status: 500 })
  }
}
