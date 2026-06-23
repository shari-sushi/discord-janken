import { eq, inArray } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teamMembers, teams } from "@/app/_domains/teamSchedules/_server/schema"
import { canCreateTeam, getSessionUserId, isUserSuspended } from "@/app/_domains/teamSchedules/_server/authz"
import { getSharePartnersForTeams } from "@/app/_domains/teamSchedules/_server/shares"
import { isManagementMode, isValidRequiredCount, isValidTeamDescription, isValidTeamName } from "@/app/_domains/teamSchedules/_server/validators"
import type { TeamSummary } from "@/app/_domains/teamSchedules/types"
import { ServerTiming } from "@/app/_server/lib/serverTiming"

/**
 * GET /api/web/team-schedules/teams
 * 比較セレクタ用のチーム一覧。閲覧できるのは「所属チーム ∪ それと共有しているチーム」だけ（#175）。
 * 未ログインは何も返さない（teams: []）。各チームに isMember / isMaster / sharedTeamIds を付与する。
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const t = new ServerTiming()
  try {
    // 未ログインは可視チーム 0 件（public read を廃止・#175）
    const userId = await t.measure("session", () => getSessionUserId(req))
    if (!userId) {
      const res = NextResponse.json({ success: true, teams: [] })
      t.applyTo(res)
      return res
    }

    // 所属チームとロール
    const memberRows = await t.measure("db_member_teams", () =>
      db.select({ teamId: teamMembers.teamId, teamRole: teamMembers.teamRole }).from(teamMembers).where(eq(teamMembers.userId, userId)),
    )
    const roleByTeam = new Map<string, string>()
    for (const r of memberRows) roleByTeam.set(r.teamId, r.teamRole)
    const ownTeamIds = [...roleByTeam.keys()]

    // 所属チームごとの共有相手（1往復）。可視チーム = 所属 ∪ 共有相手
    const partnersByTeam = await t.measure("db_share_partners", () => getSharePartnersForTeams(ownTeamIds))
    const visibleIds = new Set(ownTeamIds)
    for (const partners of partnersByTeam.values()) for (const p of partners) visibleIds.add(p)

    if (visibleIds.size === 0) {
      const res = NextResponse.json({ success: true, teams: [] })
      t.applyTo(res)
      return res
    }

    const rows = await t.measure("db_teams", () =>
      db
        .select({
          teamId: teams.teamId,
          name: teams.name,
          description: teams.description,
          requiredCount: teams.requiredCount,
          managementMode: teams.managementMode,
        })
        .from(teams)
        .where(inArray(teams.teamId, [...visibleIds])),
    )

    const list: TeamSummary[] = rows.map((r) => ({
      ...r,
      isMember: roleByTeam.has(r.teamId),
      isMaster: roleByTeam.get(r.teamId) === "master",
      // sharedTeamIds は所属チームにのみ実体が入る（partnersByTeam は ownTeamIds で引いたため）。
      // 共有相手として可視なだけのチームは空配列（その共有相手は呼び出し元には関係ない）。
      sharedTeamIds: partnersByTeam.get(r.teamId) ?? [],
    }))
    const res = NextResponse.json({ success: true, teams: list })
    t.applyTo(res)
    return res
  } catch (error) {
    console.error("team-schedules teams GET error:", error)
    // どのクエリで・何ms後に落ちたかを計測するため 500 経路にもヘッダーを付ける
    const res = NextResponse.json({ success: false, error: "チーム一覧の取得に失敗しました" }, { status: 500 })
    t.applyTo(res)
    return res
  }
}

/**
 * POST /api/web/team-schedules/teams
 * チームを新規作成する（要ログイン + 作成権限）。
 * 作成者をそのチームの master メンバーとして登録する（チームに必ず1人の master）。
 * body: { name, description, managementMode, requiredCount }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 })
    }

    // 利用停止中ユーザーは書き込み不可（#166）
    if (await isUserSuspended(userId)) {
      return NextResponse.json({ success: false, error: "アカウントが利用停止中のため、この操作はできません" }, { status: 403 })
    }

    // 作成権限（許可された Discord ID を持つユーザーのみ）
    const allowed = await canCreateTeam(userId)
    if (!allowed) {
      return NextResponse.json({ success: false, error: "チームを作成する権限がありません" }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as { name?: unknown; description?: unknown; managementMode?: unknown; requiredCount?: unknown } | null
    if (
      !body ||
      !isValidTeamName(body.name) ||
      !isValidTeamDescription(body.description ?? null) ||
      !isManagementMode(body.managementMode) ||
      !isValidRequiredCount(body.requiredCount)
    ) {
      return NextResponse.json({ success: false, error: "入力が不正です" }, { status: 400 })
    }
    const name = body.name.trim()
    const description = body.description == null ? null : (body.description as string)
    const managementMode = body.managementMode
    const requiredCount = body.requiredCount

    // チーム作成 → 作成者を master メンバーに登録。
    // neon-http はトランザクション非対応のため逐次 INSERT（auth/verify と同じ流儀）。
    // 既知のリスク: teams INSERT 成功後に team_members INSERT が失敗すると、master 不在の
    // チームが public 一覧に残る（誰も編集・招待できない孤児）。重要度は高いがエッジ。
    // 恒久対応は別 Issue で検討（neon-serverless へ移行してトランザクション化 等）。
    const inserted = await db
      .insert(teams)
      .values({ name, description, managementMode, requiredCount })
      .returning({
        teamId: teams.teamId,
        name: teams.name,
        description: teams.description,
        requiredCount: teams.requiredCount,
        managementMode: teams.managementMode,
      })
    const team = inserted[0]
    await db.insert(teamMembers).values({ teamId: team.teamId, userId, teamRole: "master" })

    const result: TeamSummary = team
    return NextResponse.json({ success: true, team: result })
  } catch (error) {
    console.error("team-schedules teams POST error:", error)
    return NextResponse.json({ success: false, error: "チームの作成に失敗しました" }, { status: 500 })
  }
}
