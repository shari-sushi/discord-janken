import { asc, eq, inArray } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { discordLinks, teamMembers, teams, users } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, getTeamRole } from "@/app/_domains/teamSchedules/_server/authz"
import { hasAdminAuthority, type TeamManagerView, type TeamMemberDetail } from "@/app/_domains/teamSchedules/types"
import { isUuid } from "@/app/_domains/teamSchedules/_server/validators"

type RouteContext = { params: Promise<{ teamId: string }> }

/**
 * GET /api/web/team-schedules/teams/[teamId]/members
 * チーム管理画面（#97）の初期表示データ（TeamManagerView）を返す。閲覧者ロールで中身が変わる:
 * - 非UUID / 未ログイン / 非メンバー: 存在を隠して 404（チーム管理画面は「そのチームのメンバーなら」開ける）
 * - member: { viewerRole: "member", members: null }（ヘッダー・見出しまでは見せ、一覧データは返さない）
 * - admin / master: members に TeamMemberDetail[]（Discord ID・招待者まで含む）
 *
 * メンバー一覧は admin 相当以上にのみ返す（member には API レベルでも返さない＝二重防御）。
 */
export async function GET(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  try {
    const { teamId } = await ctx.params

    // 未ログイン・非UUID も含めて、メンバーでなければ存在を隠して 404（401 を出さない＝チームの存在を漏らさない）
    if (!isUuid(teamId)) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }
    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }
    const viewerRole = await getTeamRole(teamId, userId)
    if (viewerRole === null) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    // チーム名はメンバーなら誰でも見せる（ヘッダー・見出し用）
    const [teamRow] = await db.select({ name: teams.name }).from(teams).where(eq(teams.teamId, teamId)).limit(1)
    if (!teamRow) {
      return NextResponse.json({ success: false, error: "チームが見つかりません" }, { status: 404 })
    }

    // member には一覧を返さない（API レベルでも隠す）。ヘッダー・見出しのみ描ける情報だけ返す
    if (!hasAdminAuthority(viewerRole)) {
      const view: TeamManagerView = { teamId, teamName: teamRow.name, viewerRole, members: null }
      return NextResponse.json({ success: true, ...view })
    }

    // admin 相当以上: メンバー詳細を組み立てる（admin/overview の流儀を踏襲）。
    // 招待者の displayName は users を self-join（inviter エイリアス）で解決する。invitedBy が null や
    // 招待者が既に削除済み（FK が set null）の行では invitedByName が null になる。
    const inviter = alias(users, "inviter")
    const memberRows = await db
      .select({
        userId: teamMembers.userId,
        displayName: users.displayName,
        teamRole: teamMembers.teamRole,
        joinedAt: teamMembers.joinedAt,
        invitedByName: inviter.displayName,
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.userId, teamMembers.userId))
      .leftJoin(inviter, eq(inviter.userId, teamMembers.invitedBy))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(asc(teamMembers.joinedAt))

    // userId → 紐づく Discord ID（複数可）のマップ。当該チームのメンバーぶんだけ引く
    const memberUserIds = memberRows.map((m) => m.userId)
    const linkRows =
      memberUserIds.length > 0
        ? await db.select({ userId: discordLinks.userId, discordUserId: discordLinks.discordUserId }).from(discordLinks).where(inArray(discordLinks.userId, memberUserIds))
        : []
    const discordIdsByUser = new Map<string, string[]>()
    for (const l of linkRows) {
      const list = discordIdsByUser.get(l.userId) ?? []
      list.push(l.discordUserId)
      discordIdsByUser.set(l.userId, list)
    }

    const members: TeamMemberDetail[] = memberRows.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      discordUserIds: discordIdsByUser.get(m.userId) ?? [],
      teamRole: m.teamRole,
      joinedAt: m.joinedAt.toISOString(),
      invitedByName: m.invitedByName ?? null,
    }))

    const view: TeamManagerView = { teamId, teamName: teamRow.name, viewerRole, members }
    return NextResponse.json({ success: true, ...view })
  } catch (error) {
    console.error("team-schedules team members GET error:", error)
    return NextResponse.json({ success: false, error: "メンバー一覧の取得に失敗しました" }, { status: 500 })
  }
}
