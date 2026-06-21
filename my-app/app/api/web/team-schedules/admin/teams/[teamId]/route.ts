import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teams } from "@/app/_domains/teamSchedules/_server/schema"
import { isUuid } from "@/app/_domains/teamSchedules/_server/validators"
import { requireAdmin } from "../../_auth"

type RouteContext = { params: Promise<{ teamId: string }> }

/**
 * DELETE /api/web/team-schedules/admin/teams/[teamId]
 * チームを強制解散する（要 admin）。team メンバーシップに依らないスーパーユーザー操作のため role チェック無し。
 *
 * teams 行を1件削除すると FK の onDelete 連鎖で関連データがまとめて消える
 * （team_members → schedules / team_day_status）。取り消し不可。
 */
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const { teamId } = await ctx.params
    if (!isUuid(teamId)) {
      return NextResponse.json({ success: false, error: "チームIDが不正です" }, { status: 400 })
    }

    const deleted = await db.delete(teams).where(eq(teams.teamId, teamId)).returning({ teamId: teams.teamId })
    if (deleted.length === 0) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules admin team DELETE error:", error)
    return NextResponse.json({ success: false, error: "チームの解散に失敗しました" }, { status: 500 })
  }
}
