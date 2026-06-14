import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teamDayStatus } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, getTeamRole } from "@/app/_domains/teamSchedules/_server/authz"
import { isDayKey, isScheduleStatus, isUuid, isValidNote } from "@/app/_domains/teamSchedules/_server/validators"

type RouteContext = { params: Promise<{ teamId: string }> }

/**
 * PUT /api/web/team-schedules/teams/[teamId]/team-status
 * チーム単位モードの日別状態を1日ぶん upsert（要ログイン + admin）。body: { day, status, note }
 */
export async function PUT(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId } = await ctx.params
    if (!isUuid(teamId)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as { day?: unknown; status?: unknown; note?: unknown } | null
    if (!body || !isDayKey(body.day) || !isScheduleStatus(body.status) || !isValidNote(body.note)) {
      return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
    }
    const { day, status } = body
    const note = body.note ?? null

    // 非メンバーは存在を隠して 404、メンバーだが admin でなければ権限不足で 400
    const role = await getTeamRole(teamId, userId)
    if (role === null) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }
    if (role !== "admin") {
      return NextResponse.json({ success: false, error: "チーム状態を編集する権限がありません" }, { status: 400 })
    }

    await db
      .insert(teamDayStatus)
      .values({ teamId, day, status, note })
      .onConflictDoUpdate({
        target: [teamDayStatus.teamId, teamDayStatus.day],
        set: { status, note, updatedAt: new Date() },
      })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules team-status PUT error:", error)
    return NextResponse.json({ success: false, error: "チーム状態の保存に失敗しました" }, { status: 500 })
  }
}

/**
 * DELETE /api/web/team-schedules/teams/[teamId]/team-status
 * チーム単位モードの日別状態を1日ぶん削除（未記入に戻す・要ログイン + admin）。body: { day }
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

    const body = (await req.json().catch(() => null)) as { day?: unknown } | null
    if (!body || !isDayKey(body.day)) {
      return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
    }
    const { day } = body

    // 非メンバーは存在を隠して 404、メンバーだが admin でなければ権限不足で 400
    const role = await getTeamRole(teamId, userId)
    if (role === null) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }
    if (role !== "admin") {
      return NextResponse.json({ success: false, error: "チーム状態を編集する権限がありません" }, { status: 400 })
    }

    await db.delete(teamDayStatus).where(and(eq(teamDayStatus.teamId, teamId), eq(teamDayStatus.day, day)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules team-status DELETE error:", error)
    return NextResponse.json({ success: false, error: "チーム状態の削除に失敗しました" }, { status: 500 })
  }
}
