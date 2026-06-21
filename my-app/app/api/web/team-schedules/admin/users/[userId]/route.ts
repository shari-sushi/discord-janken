import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { users } from "@/app/_domains/teamSchedules/_server/schema"
import { isUuid } from "@/app/_domains/teamSchedules/_server/validators"
import { requireAdmin } from "../../_auth"

type RouteContext = { params: Promise<{ userId: string }> }

/**
 * DELETE /api/web/team-schedules/admin/users/[userId]
 * ユーザーアカウントを完全削除する（要 admin）。users 行を1件削除すると FK の onDelete 連鎖で
 * 関連データがまとめて消える（team_members → schedules / discord_links）。取り消し不可。
 *
 * 割り切り（#166）: 削除対象が master を務めるチームは「自動解散しない」。
 * cascade で当該ユーザーの team_members 行だけ消え、チーム自体は master 不在のまま残る。
 * その孤児チームは管理画面で警告し、別途手動で強制解散する想定（利用者側の account 削除が
 * master 不在を 403 で防ぐのとは別方針＝admin はスーパーユーザーなので止めない）。
 */
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const { userId } = await ctx.params
    if (!isUuid(userId)) {
      return NextResponse.json({ success: false, error: "ユーザーIDが不正です" }, { status: 400 })
    }

    const deleted = await db.delete(users).where(eq(users.userId, userId)).returning({ userId: users.userId })
    if (deleted.length === 0) {
      return NextResponse.json({ success: false, error: "ユーザーが見つかりません" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules admin user DELETE error:", error)
    return NextResponse.json({ success: false, error: "ユーザーの削除に失敗しました" }, { status: 500 })
  }
}
