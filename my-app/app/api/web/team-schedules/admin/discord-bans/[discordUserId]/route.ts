import { NextRequest, NextResponse } from "next/server"
import { removeDiscordBan } from "@/app/_domains/teamSchedules/_server/bans"
import { requireAdmin } from "../../_auth"

type RouteContext = { params: Promise<{ discordUserId: string }> }

/**
 * DELETE /api/web/team-schedules/admin/discord-bans/[discordUserId]
 * Discord ID の BAN を解除する（要 admin）。解除後は magic-link での新規ログインが再び可能になる。
 */
export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const { discordUserId } = await ctx.params
    // POST 側の追加バリデーションと揃える（不正フォーマットは DB に当てず 400）
    if (!/^\d{15,21}$/.test(discordUserId)) {
      return NextResponse.json({ success: false, error: "Discord ID が不正です" }, { status: 400 })
    }
    const removed = await removeDiscordBan(discordUserId)
    if (!removed) {
      return NextResponse.json({ success: false, error: "対象の BAN が見つかりません" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("team-schedules admin discord-bans DELETE error:", error)
    return NextResponse.json({ success: false, error: "BAN の解除に失敗しました" }, { status: 500 })
  }
}
