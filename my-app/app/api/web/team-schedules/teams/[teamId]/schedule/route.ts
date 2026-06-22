import { and, between, eq } from "drizzle-orm"
import { NextRequest, NextResponse, after } from "next/server"
import { db } from "@/app/_server/lib/db"
import { schedules, teamDayStatus, teamMembers, teams, users } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, getTeamMembershipWithSuspension } from "@/app/_domains/teamSchedules/_server/authz"
import { maybeNotifyActivityReached } from "@/app/_domains/teamSchedules/_server/notify"
import { isDayKey, isScheduleStatus, isUuid, isValidNote } from "@/app/_domains/teamSchedules/_server/validators"
import type { LolRoleFlags, ScheduleEntry, TeamDayStatusEntry, TeamSchedule, TeamScheduleMember } from "@/app/_domains/teamSchedules/types"
import { ServerTiming } from "@/app/_server/lib/serverTiming"

type RouteContext = { params: Promise<{ teamId: string }> }

/**
 * GET /api/web/team-schedules/teams/[teamId]/schedule?from=&to=
 * 期間内の schedules + members（グリッド描画用・public read）。
 */
export async function GET(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const t = new ServerTiming()
  try {
    const { teamId } = await ctx.params
    if (!isUuid(teamId)) {
      // 不正なIDはリソース不存在として扱う
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    const from = req.nextUrl.searchParams.get("from")
    const to = req.nextUrl.searchParams.get("to")
    if (!isDayKey(from) || !isDayKey(to)) {
      return NextResponse.json({ success: false, error: "期間の指定が不正です" }, { status: 400 })
    }

    const teamRows = await t.measure("db_team", () =>
      db
        .select({ teamId: teams.teamId, name: teams.name, description: teams.description, requiredCount: teams.requiredCount, managementMode: teams.managementMode })
        .from(teams)
        .where(eq(teams.teamId, teamId))
        .limit(1),
    )
    const team = teamRows[0]
    if (!team) {
      const res = NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
      t.applyTo(res)
      return res
    }

    const memberRows = await t.measure("db_members", () =>
      db
        .select({
          userId: teamMembers.userId,
          displayName: users.displayName,
          teamRole: teamMembers.teamRole,
          top: teamMembers.top,
          jungle: teamMembers.jungle,
          mid: teamMembers.mid,
          adc: teamMembers.adc,
          support: teamMembers.support,
        })
        .from(teamMembers)
        .innerJoin(users, eq(users.userId, teamMembers.userId))
        .where(eq(teamMembers.teamId, teamId)),
    )

    const members: TeamScheduleMember[] = memberRows.map((m) => {
      const roles: LolRoleFlags = { top: m.top, jungle: m.jungle, mid: m.mid, adc: m.adc, support: m.support }
      return { userId: m.userId, displayName: m.displayName, teamRole: m.teamRole, roles }
    })

    const scheduleRows = await t.measure("db_schedules", () =>
      db
        .select({ userId: schedules.userId, day: schedules.day, status: schedules.status, note: schedules.note })
        .from(schedules)
        .where(and(eq(schedules.teamId, teamId), between(schedules.day, from, to))),
    )

    const scheduleEntries: ScheduleEntry[] = scheduleRows.map((s) => ({ userId: s.userId, day: s.day, status: s.status, note: s.note }))

    // チーム単位モードの日別状態（members モードでは行が無いので空になる）
    const teamStatusRows = await t.measure("db_team_status", () =>
      db
        .select({ day: teamDayStatus.day, status: teamDayStatus.status, note: teamDayStatus.note })
        .from(teamDayStatus)
        .where(and(eq(teamDayStatus.teamId, teamId), between(teamDayStatus.day, from, to))),
    )
    const teamStatusEntries: TeamDayStatusEntry[] = teamStatusRows.map((s) => ({ day: s.day, status: s.status, note: s.note }))

    const result: TeamSchedule = {
      teamId: team.teamId,
      name: team.name,
      description: team.description,
      requiredCount: team.requiredCount,
      managementMode: team.managementMode,
      members,
      schedules: scheduleEntries,
      teamStatus: teamStatusEntries,
    }
    const res = NextResponse.json({ success: true, team: result })
    t.applyTo(res)
    return res
  } catch (error) {
    console.error("team-schedules schedule GET error:", error)
    // どのクエリで・何ms後に落ちたかを計測するため 500 経路にもヘッダーを付ける
    const res = NextResponse.json({ success: false, error: "予定の取得に失敗しました" }, { status: 500 })
    t.applyTo(res)
    return res
  }
}

/**
 * PUT /api/web/team-schedules/teams/[teamId]/schedule
 * 自分の予定を1日ぶん upsert（要ログイン・本人列のみ）。body: { day, status, note }
 *
 * 仕様: team モードのチームでもメンバーは自分の予定を書き込める（モードでガードしない）。
 * team モードの表示には team_day_status を使うため、ここで作られた個人予定はグリッドに出ない
 * デッドデータになるだけで、害は無い。MVP では許容（team-status 側は逆方向の孤児を 400 で防ぐ）。
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

    // 利用停止判定とメンバーシップ取得を1クエリにまとめる（#166・DB往復削減）。
    // suspend→403 は body 検証より前、メンバー判定→404 は従来どおり body 検証の後に行う
    const { suspended, teamRole } = await getTeamMembershipWithSuspension(teamId, userId)
    if (suspended) {
      return NextResponse.json({ success: false, error: "アカウントが利用停止中のため、この操作はできません" }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as { day?: unknown; status?: unknown; note?: unknown } | null
    if (!body || !isDayKey(body.day) || !isScheduleStatus(body.status) || !isValidNote(body.note)) {
      return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
    }
    const { day, status } = body
    const note = body.note ?? null

    // 本人がそのチームの所属（team_members に存在）でなければ、存在を隠して 404
    if (teamRole === null) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    await db
      .insert(schedules)
      .values({ teamId, userId, day, status, note })
      .onConflictDoUpdate({
        target: [schedules.teamId, schedules.userId, schedules.day],
        set: { status, note, updatedAt: new Date() },
      })

    // 活動可能の立ち上がりエッジなら Webhook 通知（#172）。記入レスポンスを遅らせないよう
    // レスポンス後に実行し、内部で握るのでここの 200 には影響しない。
    after(() => maybeNotifyActivityReached(teamId, day))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules schedule PUT error:", error)
    return NextResponse.json({ success: false, error: "予定の保存に失敗しました" }, { status: 500 })
  }
}

/**
 * DELETE /api/web/team-schedules/teams/[teamId]/schedule
 * 自分の予定を1日ぶん削除（未回答に戻す・要ログイン・本人列のみ）。body: { day }
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

    // 利用停止判定とメンバーシップ取得を1クエリにまとめる（#166・DB往復削減）。
    // suspend→403 は body 検証より前、メンバー判定→404 は従来どおり body 検証の後に行う
    const { suspended, teamRole } = await getTeamMembershipWithSuspension(teamId, userId)
    if (suspended) {
      return NextResponse.json({ success: false, error: "アカウントが利用停止中のため、この操作はできません" }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as { day?: unknown } | null
    if (!body || !isDayKey(body.day)) {
      return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
    }
    const { day } = body

    if (teamRole === null) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    await db.delete(schedules).where(and(eq(schedules.teamId, teamId), eq(schedules.userId, userId), eq(schedules.day, day)))

    // ok を外して人数が閾値を下回った場合にマーカーを再武装するため、削除後も通知判定を回す（#172）
    after(() => maybeNotifyActivityReached(teamId, day))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules schedule DELETE error:", error)
    return NextResponse.json({ success: false, error: "予定の削除に失敗しました" }, { status: 500 })
  }
}
