import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId, getTeamMembershipWithSuspension } from "@/app/_domains/teamSchedules/_server/authz"
import { hasAdminAuthority } from "@/app/_domains/teamSchedules/types"
import { deleteShare } from "@/app/_domains/teamSchedules/_server/shares"
import { isUuid } from "@/app/_domains/teamSchedules/_server/validators"

type RouteContext = { params: Promise<{ teamId: string; partnerTeamId: string }> }

/**
 * DELETE /api/web/team-schedules/teams/[teamId]/shares/[partnerTeamId]
 * teamId と partnerTeamId のスケジュール共有を解除する（#175）。
 * 要ログイン + suspend不可 + [teamId] の admin。片側 admin 単独で実行でき、1行削除で両者から見えなくなる。
 * 共有が存在しなくても冪等に 200。
 */
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId, partnerTeamId } = await ctx.params
    if (!isUuid(teamId) || !isUuid(partnerTeamId)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 })
    }

    // 利用停止判定とロール取得を1クエリに（suspend→403 を先に）
    const { suspended, teamRole } = await getTeamMembershipWithSuspension(teamId, userId)
    if (suspended) {
      return NextResponse.json({ success: false, error: "アカウントが利用停止中のため、この操作はできません" }, { status: 403 })
    }
    // 解除を実行する側（teamId）の admin 以上でなければ存在を隠して 404
    if (teamRole === null || !hasAdminAuthority(teamRole)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    await deleteShare(teamId, partnerTeamId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules share DELETE error:", error)
    return NextResponse.json({ success: false, error: "スケジュール共有の解除に失敗しました" }, { status: 500 })
  }
}
