import { NextRequest, NextResponse } from "next/server"
import { redisGet, redisSet } from "@/app/_server/lib/redis/redis"
import { ENEMY_TEAMS_KEY } from "@/app/_domains/lol/_server/redisKeys"
import type { EnemyTeam } from "@/app/_domains/lol/types"

/**
 * GET /api/web/lol/ltk/teams
 * 相手チーム一覧を取得する
 */
export async function GET(): Promise<NextResponse> {
  try {
    const teams = await redisGet<EnemyTeam[]>(ENEMY_TEAMS_KEY)
    return NextResponse.json({ success: true, teams: teams ?? [] })
  } catch (error) {
    console.error("GET /api/web/lol/ltk/teams error:", error)
    return NextResponse.json({ success: false, error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}

/**
 * PUT /api/web/lol/ltk/teams
 * 相手チームを追加・更新する（同名チームがあればメンバーを上書き）
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    let body: { name: string; members: string[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: "不正なJSONフォーマットです" }, { status: 400 })
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ success: false, error: "name は必須です" }, { status: 400 })
    }
    if (!Array.isArray(body.members) || body.members.some((m) => typeof m !== "string")) {
      return NextResponse.json({ success: false, error: "members は string[] である必要があります" }, { status: 400 })
    }

    const teams = (await redisGet<EnemyTeam[]>(ENEMY_TEAMS_KEY)) ?? []
    const idx = teams.findIndex((t) => t.name === body.name)
    if (idx >= 0) {
      teams[idx] = { name: body.name, members: body.members }
    } else {
      teams.push({ name: body.name, members: body.members })
    }
    await redisSet(ENEMY_TEAMS_KEY, teams)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("PUT /api/web/lol/ltk/teams error:", error)
    return NextResponse.json({ success: false, error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}

/**
 * DELETE /api/web/lol/ltk/teams
 * 相手チームを削除する
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    let body: { name: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: "不正なJSONフォーマットです" }, { status: 400 })
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ success: false, error: "name は必須です" }, { status: 400 })
    }

    const teams = (await redisGet<EnemyTeam[]>(ENEMY_TEAMS_KEY)) ?? []
    const filtered = teams.filter((t) => t.name !== body.name)
    await redisSet(ENEMY_TEAMS_KEY, filtered)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/web/lol/ltk/teams error:", error)
    return NextResponse.json({ success: false, error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
