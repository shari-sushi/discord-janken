import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId, getTeamMembershipWithSuspension } from "@/app/_domains/teamSchedules/_server/authz"
import { hasAdminAuthority } from "@/app/_domains/teamSchedules/types"
import { createShareToken, SHARE_TTL } from "@/app/_domains/teamSchedules/_server/shares"
import { isUuid } from "@/app/_domains/teamSchedules/_server/validators"
import { APP_URL } from "@/app/_server/lib/env"

type RouteContext = { params: Promise<{ teamId: string }> }

/**
 * POST /api/web/team-schedules/teams/[teamId]/share-invite
 * 他チームとスケジュールを相互共有するための招待リンクを発行する（要ログイン + admin・#175）。
 * invite/route.ts と同型。トークンを Redis に TTL付きで保存し、受諾用URLを返す。
 */
export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId } = await ctx.params
    if (!isUuid(teamId)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 })
    }

    // 利用停止判定とロール取得を1クエリにまとめる（#166・DB往復削減）。suspend→403 を先に判定する
    const { suspended, teamRole } = await getTeamMembershipWithSuspension(teamId, userId)
    if (suspended) {
      return NextResponse.json({ success: false, error: "アカウントが利用停止中のため、この操作はできません" }, { status: 403 })
    }

    // admin（master/admin）でなければ存在を隠して 404（非メンバーもロール不足も同じ扱い）
    if (teamRole === null || !hasAdminAuthority(teamRole)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    const token = await createShareToken(teamId)
    // share= で受諾フロー（確認画面）に着地。from= は発行元チーム（確認画面の表示・取り違え検知に使う）
    const url = `${APP_URL}/team_schedules?share=${token}&from=${encodeURIComponent(teamId)}`
    const expiryDays = Math.round(SHARE_TTL / (60 * 60 * 24))
    return NextResponse.json({ success: true, url, expiryDays })
  } catch (error) {
    console.error("team-schedules share-invite POST error:", error)
    return NextResponse.json({ success: false, error: "共有リンクの発行に失敗しました" }, { status: 500 })
  }
}
