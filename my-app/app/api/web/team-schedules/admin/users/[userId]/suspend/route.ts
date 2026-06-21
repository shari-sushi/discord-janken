import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { users } from "@/app/_domains/teamSchedules/_server/schema"
import { isUuid } from "@/app/_domains/teamSchedules/_server/validators"
import { requireAdmin } from "../../../_auth"

type RouteContext = { params: Promise<{ userId: string }> }

/**
 * users.suspended を指定値に更新する共通処理（要 admin）。
 * POST=利用停止 / DELETE=解除。書き込み系 API が suspended=true の間 403 を返す（読み取りは透過）。
 */
async function setSuspended(req: NextRequest, ctx: RouteContext, suspended: boolean): Promise<NextResponse> {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const { userId } = await ctx.params
    if (!isUuid(userId)) {
      return NextResponse.json({ success: false, error: "ユーザーIDが不正です" }, { status: 400 })
    }

    const updated = await db.update(users).set({ suspended }).where(eq(users.userId, userId)).returning({ userId: users.userId })
    if (updated.length === 0) {
      return NextResponse.json({ success: false, error: "ユーザーが見つかりません" }, { status: 404 })
    }

    return NextResponse.json({ success: true, suspended })
  } catch (error) {
    console.error("team-schedules admin suspend error:", error)
    return NextResponse.json({ success: false, error: "利用停止状態の更新に失敗しました" }, { status: 500 })
  }
}

/** POST /api/web/team-schedules/admin/users/[userId]/suspend — 利用停止にする */
export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  return setSuspended(req, ctx, true)
}

/** DELETE /api/web/team-schedules/admin/users/[userId]/suspend — 利用停止を解除する */
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  return setSuspended(req, ctx, false)
}
