import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { users } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId, isAllowlistedCreator } from "@/app/_domains/teamSchedules/_server/authz"
import { ServerTiming } from "@/app/_server/lib/serverTiming"

/**
 * GET /api/web/team-schedules/session
 * ログイン中ユーザーを返す。未ログインは 401（クライアントは null として扱う）。
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const t = new ServerTiming()
  try {
    const userId = await t.measure("session_redis", () => getSessionUserId(req))
    if (!userId) {
      const res = NextResponse.json({ success: false, error: "未ログイン" }, { status: 401 })
      t.applyTo(res)
      return res
    }

    const rows = await t.measure("db_users", () => db.select({ displayName: users.displayName }).from(users).where(eq(users.userId, userId)).limit(1))
    if (!rows[0]) {
      // セッションは有効だがユーザーが消えている（退会等）→ 未ログイン扱い
      const res = NextResponse.json({ success: false, error: "未ログイン" }, { status: 401 })
      t.applyTo(res)
      return res
    }

    // 上限を無視できる許可ユーザーか（フロントは所属チーム数と組み合わせて作成・参加可否を算出する）
    const bypassTeamLimit = await t.measure("db_bypass_team_limit", () => isAllowlistedCreator(userId))
    const res = NextResponse.json({ success: true, user: { userId, displayName: rows[0].displayName, bypassTeamLimit } })
    t.applyTo(res)
    return res
  } catch (error) {
    console.error("team-schedules session error:", error)
    // どのクエリで・何ms後に落ちたかを計測するため 500 経路にもヘッダーを付ける
    const res = NextResponse.json({ success: false, error: "セッション取得に失敗しました" }, { status: 500 })
    t.applyTo(res)
    return res
  }
}
