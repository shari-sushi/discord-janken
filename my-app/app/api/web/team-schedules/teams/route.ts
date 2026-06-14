import { NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teams } from "@/app/_domains/teamSchedules/_server/schema"
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
      })
      .from(teams)

    const list: TeamSummary[] = rows
    return NextResponse.json({ success: true, teams: list })
  } catch (error) {
    console.error("team-schedules teams error:", error)
    return NextResponse.json({ success: false, error: "チーム一覧の取得に失敗しました" }, { status: 500 })
  }
}
