import { NextRequest, NextResponse } from "next/server"
import { validateAuthHeader } from "@/app/_server/lib/auth"
import { redisGet, redisSet } from "@/app/_server/lib/redis/redis"
import { SELF_TEAM_KEY } from "@/app/domains/lol/_server/redisKeys"

/**
 * GET /api/web/lol/opgg/self-team
 * 自チームメンバー一覧を取得する
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await validateAuthHeader(request.headers.get("Authorization"))
    if (!authResult.valid) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 })
    }

    const members = await redisGet<string[]>(SELF_TEAM_KEY)
    return NextResponse.json({ success: true, members: members ?? [] })
  } catch (error) {
    console.error("GET /api/web/lol/opgg/self-team error:", error)
    return NextResponse.json({ success: false, error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}

/**
 * PUT /api/web/lol/opgg/self-team
 * 自チームメンバーを更新する
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    let body: { members: string[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: "不正なJSONフォーマットです" }, { status: 400 })
    }

    if (!Array.isArray(body.members) || body.members.some((m) => typeof m !== "string")) {
      return NextResponse.json({ success: false, error: "members は string[] である必要があります" }, { status: 400 })
    }

    await redisSet(SELF_TEAM_KEY, body.members)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("PUT /api/web/lol/opgg/self-team error:", error)
    return NextResponse.json({ success: false, error: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
