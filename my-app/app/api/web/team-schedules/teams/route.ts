import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teamMembers, teams } from "@/app/_domains/teamSchedules/_server/schema"
import { canCreateTeam, getSessionUserId } from "@/app/_domains/teamSchedules/_server/authz"
import { isManagementMode, isValidRequiredCount, isValidTeamDescription, isValidTeamName } from "@/app/_domains/teamSchedules/_server/validators"
import type { TeamSummary } from "@/app/_domains/teamSchedules/types"

/**
 * GET /api/web/team-schedules/teams
 * チーム一覧（比較セレクタ用・public read）。
 */
export async function GET(): Promise<NextResponse> {
  try {
    const rows = await db
      .select({
        teamId: teams.teamId,
        name: teams.name,
        description: teams.description,
        requiredCount: teams.requiredCount,
        managementMode: teams.managementMode,
      })
      .from(teams)

    const list: TeamSummary[] = rows
    return NextResponse.json({ success: true, teams: list })
  } catch (error) {
    console.error("team-schedules teams GET error:", error)
    return NextResponse.json({ success: false, error: "チーム一覧の取得に失敗しました" }, { status: 500 })
  }
}

/**
 * POST /api/web/team-schedules/teams
 * チームを新規作成する（要ログイン + 作成権限）。
 * 作成者をそのチームの admin メンバーとして登録する。
 * body: { name, description, managementMode, requiredCount }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 })
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

    // チーム作成 → 作成者を admin メンバーに登録。
    // neon-http はトランザクション非対応のため逐次 INSERT（auth/verify と同じ流儀）。
    // 既知のリスク: teams INSERT 成功後に team_members INSERT が失敗すると、admin 不在の
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
    await db.insert(teamMembers).values({ teamId: team.teamId, userId, teamRole: "admin" })

    const result: TeamSummary = team
    return NextResponse.json({ success: true, team: result })
  } catch (error) {
    console.error("team-schedules teams POST error:", error)
    return NextResponse.json({ success: false, error: "チームの作成に失敗しました" }, { status: 500 })
  }
}
