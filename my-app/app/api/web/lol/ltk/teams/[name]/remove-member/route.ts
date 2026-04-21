import { NextRequest, NextResponse } from "next/server"
import { redisGet, redisSet } from "@/app/_server/lib/redis/redis"
import { ENEMY_TEAMS_KEY } from "@/app/_domains/lol/_server/redisKeys"
import type { EnemyTeam } from "@/app/_domains/lol/types"

/**
 * POST /api/web/lol/ltk/teams/[name]/remove-member
 * チームから指定メンバーを1人除名する。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
): Promise<NextResponse> {
  try {
    const { name: currentName } = await params
    const teamName = decodeURIComponent(currentName)

    let body: { member: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: "不正なJSONフォーマットです" }, { status: 400 })
    }

    if (!body.member || typeof body.member !== "string") {
      return NextResponse.json({ success: false, error: "member は必須です" }, { status: 400 })
    }

    const teams = (await redisGet<EnemyTeam[]>(ENEMY_TEAMS_KEY)) ?? []
    const idx = teams.findIndex((t) => t.name === teamName)

    if (idx < 0) {
      return NextResponse.json({ success: false, error: "指定されたチームが見つかりません" }, { status: 404 })
    }

    const updated: EnemyTeam = {
      name: teams[idx].name,
      members: teams[idx].members.filter((m) => m !== body.member),
    }

    teams[idx] = updated
    await redisSet(ENEMY_TEAMS_KEY, teams)

    return NextResponse.json({ success: true, team: updated })
  } catch (error) {
    console.error("POST /api/web/lol/ltk/teams/[name]/remove-member error:", error)
    return NextResponse.json({ success: false, error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
