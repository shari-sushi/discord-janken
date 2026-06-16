import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teamMembers, teams } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId } from "@/app/_domains/teamSchedules/_server/authz"
import { inviteKey } from "@/app/_domains/teamSchedules/_server/redisKeys"
import type { InvitePayload } from "@/app/_domains/teamSchedules/_server/invites"
import { redisGet } from "@/app/_server/lib/redis/redis"
import type { TeamSummary } from "@/app/_domains/teamSchedules/types"

/**
 * POST /api/web/team-schedules/join
 * 招待トークンを使ってチームに参加する（要ログイン）。
 * body: { token }
 *
 * 招待は複数人で使うため使用後も削除しない（TTLで失効）。
 * 既に所属済みなら何もしない（冪等）。member ロールで参加する。
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as { token?: unknown } | null
    const token = body?.token
    if (typeof token !== "string" || !token) {
      return NextResponse.json({ success: false, error: "招待トークンが不正です" }, { status: 400 })
    }

    const payload = await redisGet<InvitePayload>(inviteKey(token))
    if (!payload) {
      return NextResponse.json({ success: false, error: "招待リンクの有効期限が切れているか、無効です" }, { status: 401 })
    }
    const { teamId } = payload

    const teamRows = await db
      .select({
        teamId: teams.teamId,
        name: teams.name,
        description: teams.description,
        requiredCount: teams.requiredCount,
        managementMode: teams.managementMode,
      })
      .from(teams)
      .where(eq(teams.teamId, teamId))
      .limit(1)
    const team = teamRows[0]
    if (!team) {
      // チームが削除済み等。招待が指す先が無い
      return NextResponse.json({ success: false, error: "参加先のチームが見つかりません" }, { status: 404 })
    }

    // 既に所属していれば何もしない（冪等）。新規なら member で参加
    await db.insert(teamMembers).values({ teamId, userId, teamRole: "member" }).onConflictDoNothing({
      target: [teamMembers.teamId, teamMembers.userId],
    })

    const result: TeamSummary = team
    return NextResponse.json({ success: true, team: result })
  } catch (error) {
    console.error("team-schedules join POST error:", error)
    return NextResponse.json({ success: false, error: "チームへの参加に失敗しました" }, { status: 500 })
  }
}
