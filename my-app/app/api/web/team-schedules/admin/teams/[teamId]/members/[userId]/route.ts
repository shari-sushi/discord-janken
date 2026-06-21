import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teamMembers } from "@/app/_domains/teamSchedules/_server/schema"
import { isUuid } from "@/app/_domains/teamSchedules/_server/validators"
import { requireAdmin } from "../../../../_auth"

type RouteContext = { params: Promise<{ teamId: string; userId: string }> }

/**
 * DELETE /api/web/team-schedules/admin/teams/[teamId]/members/[userId]
 * 指定メンバーをチームから除外する（要 admin）。team_members 行を1件削除し、
 * 複合FK の cascade でそのチーム内のそのユーザーの schedules も消える。
 *
 * 割り切り: master の除外はブロックする（master 不在の孤児チームを作らないため）。
 * master を外したいときはチーム強制解散、または別途 master 移譲後に除外する。
 */
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const { teamId, userId } = await ctx.params
    if (!isUuid(teamId) || !isUuid(userId)) {
      return NextResponse.json({ success: false, error: "IDが不正です" }, { status: 400 })
    }

    const rows = await db
      .select({ teamRole: teamMembers.teamRole })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .limit(1)
    const member = rows[0]
    if (!member) {
      return NextResponse.json({ success: false, error: "対象のメンバーが見つかりません" }, { status: 404 })
    }
    if (member.teamRole === "master") {
      return NextResponse.json(
        { success: false, error: "管理者（master）は除外できません。チームを強制解散するか、先に master を別メンバーへ移譲してください。" },
        { status: 400 },
      )
    }

    await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules admin member DELETE error:", error)
    return NextResponse.json({ success: false, error: "メンバーの除外に失敗しました" }, { status: 500 })
  }
}
