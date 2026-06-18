import { NextRequest, NextResponse } from "next/server"
import { TS_SESSION_COOKIE, deleteUserSession, sessionCookieOptions } from "@/app/_domains/teamSchedules/_server/session"

/**
 * POST /api/web/team-schedules/auth/logout
 * ログイン中ユーザーのセッションを破棄し、ts_session Cookie を失効させる。
 * 再ログインには Discord Bot の `/team-schedule-login`（新しい magic-link 発行）が必要。
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 未ログイン（Cookie 無し）でも 200 を返す（冪等：既にログアウト済みと同義）
    const token = req.cookies.get(TS_SESSION_COOKIE)?.value
    if (token) await deleteUserSession(token)

    const res = NextResponse.json({ success: true })
    res.cookies.set(TS_SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 })
    return res
  } catch (error) {
    console.error("team-schedules auth/logout error:", error)
    return NextResponse.json({ success: false, error: "ログアウトに失敗しました" }, { status: 500 })
  }
}
