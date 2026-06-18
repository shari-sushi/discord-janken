import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { teamMembers, users } from "@/app/_domains/teamSchedules/_server/schema"
import { getSessionUserId } from "@/app/_domains/teamSchedules/_server/authz"
import { TS_SESSION_COOKIE, deleteUserSession, sessionCookieOptions } from "@/app/_domains/teamSchedules/_server/session"

/**
 * DELETE /api/web/team-schedules/account
 * ログイン中ユーザー自身のアカウントと、紐づく全データを物理削除する（取り消し不可）。
 *
 * users 行を1件削除すれば FK の onDelete 連鎖で関連データがまとめて消える:
 * - team_members（userId, onDelete: cascade）→ schedules（複合FK, onDelete: cascade）
 * - discord_links（userId, onDelete: cascade）＝ Discord ID 紐づけも削除
 * - 他メンバーの team_members.invited_by は set null（記録は残すが発行者参照だけ消す）
 *
 * master を持つチームがある場合は削除不可（チームに master が必ず1人必要なため孤児化を防ぐ）。
 * 先に別メンバーへ管理者を移譲してから削除する想定 → 403。
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getSessionUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 })
    }

    // master を務めるチームが1つでもあれば削除をブロック（孤児チームを作らない）
    const masterRows = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamRole, "master")))
      .limit(1)
    if (masterRows.length > 0) {
      return NextResponse.json(
        { success: false, error: "管理者（master）を務めるチームがあります。先に別のメンバーに管理者を移譲してください。" },
        { status: 403 },
      )
    }

    // users を物理削除（FK cascade で関連データも連鎖削除される）
    await db.delete(users).where(eq(users.userId, userId))

    // セッションも破棄し Cookie を失効させる（削除済みアカウントに戻れないように）
    const token = req.cookies.get(TS_SESSION_COOKIE)?.value
    if (token) await deleteUserSession(token)

    const res = NextResponse.json({ success: true })
    res.cookies.set(TS_SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 })
    return res
  } catch (error) {
    console.error("team-schedules account DELETE error:", error)
    return NextResponse.json({ success: false, error: "アカウントの削除に失敗しました" }, { status: 500 })
  }
}
