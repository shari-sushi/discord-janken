import { NextRequest, NextResponse } from "next/server"
import { assertTeamAdmin, getSessionUserId } from "@/app/_domains/teamSchedules/_server/authz"
import { createInviteToken, INVITE_TTL } from "@/app/_domains/teamSchedules/_server/invites"
import { isUuid } from "@/app/_domains/teamSchedules/_server/validators"
import { APP_URL } from "@/app/_server/lib/env"

type RouteContext = { params: Promise<{ teamId: string }> }

/**
 * POST /api/web/team-schedules/teams/[teamId]/invite
 * チームの招待リンクを発行する（要ログイン + admin）。
 * トークンを Redis に TTL付きで保存し、参加用URLを返す（複数人で利用可・TTLで失効）。
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

    // admin でなければ存在を隠して 404
    const isAdmin = await assertTeamAdmin(teamId, userId)
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    const token = await createInviteToken(teamId, userId)

    // join= で参加させつつ、team= で着地後に対象チームを自チーム選択させる。
    // （未参加→参加でも、既に参加済みでも、同じリンクから対象チームが選択される導線になる）
    const url = `${APP_URL}/team_schedules?join=${token}&team=${encodeURIComponent(teamId)}`
    const expiryDays = Math.round(INVITE_TTL / (60 * 60 * 24))
    return NextResponse.json({ success: true, url, expiryDays })
  } catch (error) {
    console.error("team-schedules invite POST error:", error)
    return NextResponse.json({ success: false, error: "招待リンクの発行に失敗しました" }, { status: 500 })
  }
}
