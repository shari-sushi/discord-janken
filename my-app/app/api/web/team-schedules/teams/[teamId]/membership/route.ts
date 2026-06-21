import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teamMembers } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, getTeamRole } from "@/app/_domains/teamSchedules/_server/authz"
import { isUuid } from "@/app/_domains/teamSchedules/_server/validators"

type RouteContext = { params: Promise<{ teamId: string }> }

/**
 * DELETE /api/web/team-schedules/teams/[teamId]/membership
 * ログイン中ユーザー自身をこのチームから脱退させる（自分の team_members 行を削除）。
 *
 * - 非UUID / 非メンバー: 存在を隠して 404（他ルートと同じ流儀）
 * - master は脱退不可（チームには master が必ず1人必要なため）。別メンバーへ移譲してから脱退する想定 → 403
 * - それ以外のメンバー（admin / member）: 自分の行を削除して 200
 *
 * 注: チームそのものの削除ではない（DELETE /teams/[teamId] とは別操作）。
 *
 * #166: 利用停止中（suspended）でも脱退は許可する（isUserSuspended ガードを意図的に付けない）。
 *       suspend は「新しいコンテンツ・参加を作らせない」ための制限で、自分の footprint を減らす
 *       自己片付け（脱退・アカウント削除）は止めない方針。チーム設定編集/解散（PATCH/DELETE teams）は
 *       コンテンツ書き込みなのでガード対象、という非対称を明示しておく。
 */
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId } = await ctx.params

    if (!isUuid(teamId)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 })
    }

    const role = await getTeamRole(teamId, userId)
    if (role === null) {
      // 非メンバー（または削除済みチーム）は存在を隠して 404
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }
    if (role === "master") {
      // master 不在のチームを作らないため、master の脱退は禁止する（先に別メンバーへ移譲が必要）
      return NextResponse.json({ success: false, error: "管理者（master）は脱退できません。別のメンバーに管理者を移譲してください。" }, { status: 403 })
    }

    await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules membership DELETE error:", error)
    return NextResponse.json({ success: false, error: "チームからの脱退に失敗しました" }, { status: 500 })
  }
}
