import { and, between, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { schedules, teamDayStatus, teamMembers, teams, users } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, assertTeamMember } from "@/app/_domains/teamSchedules/_server/authz"
import { isDayKey, isScheduleStatus, isUuid, isValidNote } from "@/app/_domains/teamSchedules/_server/validators"
import type { LolRoleFlags, ScheduleEntry, TeamDayStatusEntry, TeamSchedule, TeamScheduleMember } from "@/app/_domains/teamSchedules/types"

type RouteContext = { params: Promise<{ teamId: string }> }

/**
 * GET /api/web/team-schedules/teams/[teamId]/schedule?from=&to=
 * 期間内の schedules + members（グリッド描画用・public read）。
 */
export async function GET(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
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

    const teamRows = await db
      .select({ teamId: teams.teamId, name: teams.name, description: teams.description, requiredCount: teams.requiredCount, managementMode: teams.managementMode })
      .from(teams)
      .where(eq(teams.teamId, teamId))
      .limit(1)
    const team = teamRows[0]
    if (!team) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    const memberRows = await db
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
      .where(eq(teamMembers.teamId, teamId))

    const members: TeamScheduleMember[] = memberRows.map((m) => {
      const roles: LolRoleFlags = { top: m.top, jungle: m.jungle, mid: m.mid, adc: m.adc, support: m.support }
      return { userId: m.userId, displayName: m.displayName, teamRole: m.teamRole, roles }
    })

    const scheduleRows = await db
      .select({ userId: schedules.userId, day: schedules.day, status: schedules.status, note: schedules.note })
      .from(schedules)
      .where(and(eq(schedules.teamId, teamId), between(schedules.day, from, to)))

    const scheduleEntries: ScheduleEntry[] = scheduleRows.map((s) => ({ userId: s.userId, day: s.day, status: s.status, note: s.note }))

    // チーム単位モードの日別状態（members モードでは行が無いので空になる）
    const teamStatusRows = await db
      .select({ day: teamDayStatus.day, status: teamDayStatus.status, note: teamDayStatus.note })
      .from(teamDayStatus)
      .where(and(eq(teamDayStatus.teamId, teamId), between(teamDayStatus.day, from, to)))
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
    return NextResponse.json({ success: true, team: result })
  } catch (error) {
    console.error("team-schedules schedule GET error:", error)
    return NextResponse.json({ success: false, error: "予定の取得に失敗しました" }, { status: 500 })
  }
}

/**
 * PUT /api/web/team-schedules/teams/[teamId]/schedule
 * 自分の予定を1日ぶん upsert（要ログイン・本人列のみ）。body: { day, status, note }
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

    // 本人がそのチームの所属（team_members に存在）でなければ、存在を隠して 404
    const isMember = await assertTeamMember(teamId, userId)
    if (!isMember) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    await db
      .insert(schedules)
      .values({ teamId, userId, day, status, note })
      .onConflictDoUpdate({
        target: [schedules.teamId, schedules.userId, schedules.day],
        set: { status, note, updatedAt: new Date() },
      })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules schedule PUT error:", error)
    return NextResponse.json({ success: false, error: "予定の保存に失敗しました" }, { status: 500 })
  }
}

/**
 * DELETE /api/web/team-schedules/teams/[teamId]/schedule
 * 自分の予定を1日ぶん削除（未記入に戻す・要ログイン・本人列のみ）。body: { day }
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

    const isMember = await assertTeamMember(teamId, userId)
    if (!isMember) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    await db.delete(schedules).where(and(eq(schedules.teamId, teamId), eq(schedules.userId, userId), eq(schedules.day, day)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules schedule DELETE error:", error)
    return NextResponse.json({ success: false, error: "予定の削除に失敗しました" }, { status: 500 })
  }
}
