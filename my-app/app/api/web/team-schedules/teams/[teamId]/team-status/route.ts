import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teamDayStatus, teams } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, getTeamMembershipWithSuspension } from "@/app/_domains/teamSchedules/_server/authz"
import { hasAdminAuthority } from "@/app/_domains/teamSchedules/types"
import { isDayKey, isScheduleStatus, isUuid, isValidNote } from "@/app/_domains/teamSchedules/_server/validators"

type RouteContext = { params: Promise<{ teamId: string }> }

/** 認可に失敗したら返すべきレスポンス、成功なら ok を返す */
type AuthzResult = { ok: true } | { ok: false; res: NextResponse }

/**
 * team-status を編集できるかを「認証 → 認可 → モード確認」の順に判定する。
 * 入力検証より前に呼ぶこと（権限の無い相手の body は処理しない）。
 * - 非UUID / 非メンバー: 存在を隠して 404
 * - メンバーだが admin 相当未満（member）: 権限不足で 400
 * - team モード以外のチーム: この機能の対象外で 400（members モードに孤児行を作らせない）
 */
async function authorizeTeamStatusAdmin(req: NextRequest, teamId: string): Promise<AuthzResult> {
  if (!isUuid(teamId)) {
    return { ok: false, res: NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 }) }
  }

  const userId = await getSessionUserId(req)
  if (!userId) {
    return { ok: false, res: NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 }) }
  }

  // 利用停止判定とロール取得を1クエリにまとめる（#166・DB往復削減）。suspend→403 を先に判定する
  const { suspended, teamRole: role } = await getTeamMembershipWithSuspension(teamId, userId)
  if (suspended) {
    return { ok: false, res: NextResponse.json({ success: false, error: "アカウントが利用停止中のため、この操作はできません" }, { status: 403 }) }
  }
  if (role === null) {
    return { ok: false, res: NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 }) }
  }
  if (!hasAdminAuthority(role)) {
    return { ok: false, res: NextResponse.json({ success: false, error: "チーム状態を編集する権限がありません" }, { status: 400 }) }
  }

  const rows = await db.select({ managementMode: teams.managementMode }).from(teams).where(eq(teams.teamId, teamId)).limit(1)
  if (rows[0]?.managementMode !== "team") {
    return { ok: false, res: NextResponse.json({ success: false, error: "このチームはチーム単位モードではありません" }, { status: 400 }) }
  }

  return { ok: true }
}

/**
 * PUT /api/web/team-schedules/teams/[teamId]/team-status
 * チーム単位モードの日別状態を1日ぶん upsert（要ログイン + admin）。body: { day, status, note }
 */
export async function PUT(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId } = await ctx.params

    const authz = await authorizeTeamStatusAdmin(req, teamId)
    if (!authz.ok) return authz.res

    const body = (await req.json().catch(() => null)) as { day?: unknown; status?: unknown; note?: unknown } | null
    if (!body || !isDayKey(body.day) || !isScheduleStatus(body.status) || !isValidNote(body.note)) {
      return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
    }
    const { day, status } = body
    const note = body.note ?? null

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
 * チーム単位モードの日別状態を1日ぶん削除（未回答に戻す・要ログイン + admin）。body: { day }
 */
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId } = await ctx.params

    const authz = await authorizeTeamStatusAdmin(req, teamId)
    if (!authz.ok) return authz.res

    const body = (await req.json().catch(() => null)) as { day?: unknown } | null
    if (!body || !isDayKey(body.day)) {
      return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
    }
    const { day } = body

    await db.delete(teamDayStatus).where(and(eq(teamDayStatus.teamId, teamId), eq(teamDayStatus.day, day)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules team-status DELETE error:", error)
    return NextResponse.json({ success: false, error: "チーム状態の削除に失敗しました" }, { status: 500 })
  }
}
