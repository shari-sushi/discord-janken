import { NextRequest, NextResponse } from "next/server"
import { magicLinkKey } from "@/app/_domains/teamSchedules/_server/redisKeys"
import { createUserSession, sessionCookieOptions, TS_SESSION_COOKIE } from "@/app/_domains/teamSchedules/_server/session"
import { canCreateTeam } from "@/app/_domains/teamSchedules/_server/authz"
import { isDiscordBanned } from "@/app/_domains/teamSchedules/_server/bans"
import { resolveOrCreateUserByDiscordId } from "@/app/_domains/teamSchedules/_server/userResolver"
import { redisGet, redisDelete } from "@/app/_server/lib/redis/redis"
import type { MagicLinkPayload } from "@/app/_domains/teamSchedules/_server/magicLink"

/**
 * magic-link 検証エンドポイント。
 *
 * - Redis から token を GET → 無ければ 401。即 DELETE（単回使用・期限切れは Redis TTL で消える）
 * - discord_links を discordUserId で検索。無ければ users + discord_links を INSERT
 *   （セルフサインアップ、display_name = Discordユーザー名）
 * - 利用者セッションを作成し、ts_session Cookie を設定
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let tokenPrefix = "(none)"
  try {
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null
    const token = body?.token
    if (typeof token !== "string" || !token) {
      return NextResponse.json({ success: false, error: "トークンが不正です" }, { status: 400 })
    }
    // 相関用にトークン先頭のみログ出力（全体は秘匿）。クライアントには成否以上を返さない方針
    tokenPrefix = token.slice(0, 10)

    const payload = await redisGet<MagicLinkPayload>(magicLinkKey(token))
    if (!payload) {
      console.warn(`team-schedules auth/verify: token not found (expired/used) token=${tokenPrefix}…`)
      return NextResponse.json({ success: false, error: "リンクの有効期限が切れているか、既に使用済みです" }, { status: 401 })
    }
    // 相関はトークン先頭プレフィックスのみで行う（discordUserId/userId はログに残さない）
    console.log(`team-schedules auth/verify: token ok token=${tokenPrefix}…`)
    // 単回使用: 検証できた時点で即削除
    await redisDelete(magicLinkKey(token))

    const { discordUserId, username } = payload

    // BAN 済み Discord ID は新規ログイン/サインアップを遮断（#166）。
    // ↓注意: 既に ts_session を持つユーザーの即時失効はここでは行わない（将来対応）。
    if (await isDiscordBanned(discordUserId)) {
      console.warn(`team-schedules auth/verify: banned discord id rejected token=${tokenPrefix}…`)
      return NextResponse.json({ success: false, error: "このアカウントはご利用いただけません" }, { status: 403 })
    }

    // discord_links を引いて既存ユーザーを解決。無ければセルフサインアップで作成
    const { userId, displayName } = await resolveOrCreateUserByDiscordId(discordUserId, username)

    const sessionToken = await createUserSession(userId)

    const allowed = await canCreateTeam(userId)
    console.log(`team-schedules auth/verify: session created token=${tokenPrefix}… canCreateTeam=${allowed}`)
    const res = NextResponse.json({ success: true, user: { userId, displayName, canCreateTeam: allowed } })
    res.cookies.set(TS_SESSION_COOKIE, sessionToken, sessionCookieOptions())
    return res
  } catch (error) {
    // クライアントには汎用 500 のみ返し、原因（多くは DB 接続/クエリ失敗）はサーバーログにだけ残す
    console.error(`team-schedules auth/verify error: token=${tokenPrefix}…:`, error)
    return NextResponse.json({ success: false, error: "ログイン処理に失敗しました" }, { status: 500 })
  }
}
