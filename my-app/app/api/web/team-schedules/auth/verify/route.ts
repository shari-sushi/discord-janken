import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/app/_server/lib/db"
import { discordLinks, users } from "@/app/_domains/teamSchedules/_server/schema"
import { magicLinkKey } from "@/app/_domains/teamSchedules/_server/redisKeys"
import { createUserSession, sessionCookieOptions, TS_SESSION_COOKIE } from "@/app/_domains/teamSchedules/_server/session"
import { canCreateTeam } from "@/app/_domains/teamSchedules/_server/authz"
import { redisGet, redisDelete } from "@/app/_server/lib/redis/redis"
import type { MagicLinkPayload } from "@/app/api/discord/command/team-schedule/login"

/**
 * magic-link 検証エンドポイント。
 *
 * - Redis から token を GET → 無ければ 401。即 DELETE（単回使用・期限切れは Redis TTL で消える）
 * - discord_links を discordUserId で検索。無ければ users + discord_links を INSERT
 *   （セルフサインアップ、display_name = Discordユーザー名）
 * - 利用者セッションを作成し、ts_session Cookie を設定
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null
    const token = body?.token
    if (typeof token !== "string" || !token) {
      return NextResponse.json({ success: false, error: "トークンが不正です" }, { status: 400 })
    }

    const payload = await redisGet<MagicLinkPayload>(magicLinkKey(token))
    if (!payload) {
      return NextResponse.json({ success: false, error: "リンクの有効期限が切れているか、既に使用済みです" }, { status: 401 })
    }
    // 単回使用: 検証できた時点で即削除
    await redisDelete(magicLinkKey(token))

    const { discordUserId, username } = payload

    // 既存リンクを検索。無ければ users + discord_links を作成（セルフサインアップ）
    const existing = await db.select({ userId: discordLinks.userId }).from(discordLinks).where(eq(discordLinks.discordUserId, discordUserId)).limit(1)

    let userId: string
    let displayName: string
    if (existing[0]) {
      userId = existing[0].userId
      const userRow = await db.select({ displayName: users.displayName }).from(users).where(eq(users.userId, userId)).limit(1)
      displayName = userRow[0]?.displayName ?? username
    } else {
      // passwordless（Discord magic-link）。password_hash は schema 上 notNull のため空文字で埋める
      // （認証方式が確定済みなので、将来別マイグレーションで列ごと削除予定）
      // 既知のリスク: neon-http はトランザクション非対応のため users / discord_links を逐次 INSERT。
      // users INSERT 成功後に discord_links INSERT が失敗すると、次回ログインでリンクが見つからず
      // 別 user が再作成され重複する。重要度は高いがエッジ。恒久対応は別 Issue で検討（teams POST と同件）。
      const inserted = await db.insert(users).values({ displayName: username, passwordHash: "" }).returning({ userId: users.userId, displayName: users.displayName })
      userId = inserted[0].userId
      displayName = inserted[0].displayName
      await db.insert(discordLinks).values({ discordUserId, userId })
    }

    const sessionToken = await createUserSession(userId)

    const allowed = await canCreateTeam(userId)
    const res = NextResponse.json({ success: true, user: { userId, displayName, canCreateTeam: allowed } })
    res.cookies.set(TS_SESSION_COOKIE, sessionToken, sessionCookieOptions())
    return res
  } catch (error) {
    console.error("team-schedules auth/verify error:", error)
    return NextResponse.json({ success: false, error: "ログイン処理に失敗しました" }, { status: 500 })
  }
}
