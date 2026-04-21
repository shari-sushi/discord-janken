import { NextRequest, NextResponse } from "next/server"
import { redisGet, redisSet } from "@/app/_server/lib/redis/redis"
import { ENEMY_TEAMS_KEY } from "@/app/_domains/lol/_server/redisKeys"
import type { EnemyTeam } from "@/app/_domains/lol/types"

/**
 * POST /api/web/lol/ltk/teams/[name]/add-member
 * チーム名変更・メンバーリスト更新を行うパッチ操作。
 * name / members のうち送信された（undefined でない）フィールドのみを上書きする。
 * チーム名変更時は teams リスト内のエントリ自体も新しいキーで更新される。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
): Promise<NextResponse> {
  try {
    const { name: currentName } = await params
    const teamName = decodeURIComponent(currentName)

    let body: { name?: string; members?: string[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: "不正なJSONフォーマットです" }, { status: 400 })
    }

    // name / members のどちらも未指定の場合はエラー
    if (body.name === undefined && body.members === undefined) {
      return NextResponse.json({ success: false, error: "name または members のいずれかが必要です" }, { status: 400 })
    }

    if (body.name !== undefined && typeof body.name !== "string") {
      return NextResponse.json({ success: false, error: "name は string である必要があります" }, { status: 400 })
    }

    if (body.members !== undefined && (!Array.isArray(body.members) || body.members.some((m) => typeof m !== "string"))) {
      return NextResponse.json({ success: false, error: "members は string[] である必要があります" }, { status: 400 })
    }

    const teams = (await redisGet<EnemyTeam[]>(ENEMY_TEAMS_KEY)) ?? []
    const idx = teams.findIndex((t) => t.name === teamName)

    if (idx < 0) {
      return NextResponse.json({ success: false, error: "指定されたチームが見つかりません" }, { status: 404 })
    }

    const updated: EnemyTeam = {
      name: body.name ?? teams[idx].name,
      members: body.members ?? teams[idx].members,
    }

    teams[idx] = updated
    await redisSet(ENEMY_TEAMS_KEY, teams)

    return NextResponse.json({ success: true, team: updated })
  } catch (error) {
    console.error("POST /api/web/lol/ltk/teams/[name]/add-member error:", error)
    return NextResponse.json({ success: false, error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
