import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { users } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId } from "@/app/_domains/teamSchedules/_server/authz"

/**
 * GET /api/web/team-schedules/session
 * ログイン中ユーザーを返す。未ログインは 401（クライアントは null として扱う）。
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "未ログイン" }, { status: 401 })
    }

    const rows = await db.select({ displayName: users.displayName }).from(users).where(eq(users.userId, userId)).limit(1)
    if (!rows[0]) {
      // セッションは有効だがユーザーが消えている（退会等）→ 未ログイン扱い
      return NextResponse.json({ success: false, error: "未ログイン" }, { status: 401 })
    }

    return NextResponse.json({ success: true, user: { userId, displayName: rows[0].displayName } })
  } catch (error) {
    console.error("team-schedules session error:", error)
    return NextResponse.json({ success: false, error: "セッション取得に失敗しました" }, { status: 500 })
  }
}
