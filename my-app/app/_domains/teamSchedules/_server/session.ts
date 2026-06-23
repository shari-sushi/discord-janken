/**
 * スクリム調整機能 - 利用者セッション（権限ドメインの完全分離）
 *
 * 開発者/管理者用の `app/_server/lib/session.ts` とは **意図的に分離** している。
 * 共用すると magic-link でログインした一般ユーザーが、開発者用 Redis CRUD 管理UI を
 * 突破できてしまうため（SessionData の共用・validateSession の拡張は禁止）。
 *
 * - Redis キー prefix: `ts-session:`
 * - Cookie: `ts_session`（HttpOnly + Secure + SameSite=Lax）
 * - SessionData は userId(uuid) ベース
 */

import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import type { NextRequest } from "next/server"
import { redisGet, redisSet, redisDelete } from "@/app/_server/lib/redis/redis"
import { userSessionKey } from "./redisKeys"
import { ENV } from "@/app/_server/lib/env"

/** Cookie 名（開発者用とは別物） */
export const TS_SESSION_COOKIE = "ts_session"

// 一般ユーザーは UX 優先でスライディング有効期限（常用者はログアウトされない）。
// 有効期限 10 日。アクセス時に残りが REFRESH しきい値を切っていれば 10 日に延長する。
const SESSION_EXPIRY = 60 * 60 * 24 * 10 // 10 days in seconds
// 残り3日未満のアクセスでのみ延長する（毎リクエストの Redis 書き込み/Cookie 再発行を避ける）。
const SESSION_REFRESH_THRESHOLD_MS = 60 * 60 * 24 * 3 * 1000 // 3 days in ms

export interface UserSessionData {
  userId: string
  createdAt: number
  /** 有効期限（ms epoch）。スライディング更新の残り時間判定に使う。
   *  本変更より前に発行された旧セッションには無い（次回アクセスで補填）ため optional。 */
  expiresAt?: number
}

function generateSessionToken(): string {
  return randomBytes(32).toString("hex")
}

/** セッションを作成し、トークンを返す（呼び出し側で Cookie に載せる） */
export async function createUserSession(userId: string): Promise<string> {
  const token = generateSessionToken()
  const now = Date.now()
  const data: UserSessionData = { userId, createdAt: now, expiresAt: now + SESSION_EXPIRY * 1000 }
  await redisSet(userSessionKey(token), data, SESSION_EXPIRY)
  return token
}

/**
 * リクエストの Cookie からログイン中ユーザーIDを解決する（未認証は null）。
 *
 * スライディング更新: 残り有効期限がしきい値（3日）未満なら、Redis TTL と Cookie の両方を
 * 10 日に貼り直す。Cookie は NextResponse ではなく next/headers の cookies() 経由で書くため、
 * 全ルートの応答に自動反映される（各ルート側の改修は不要）。
 * expiresAt 未設定の旧セッションは、次回アクセス時にスライディング方式へ移行させる。
 *
 * 注意: cookies() は動的リクエストコンテキスト（route handler / server action）でのみ呼べる。
 * この関数は route handler からのみ使うこと（Server Component / middleware からは呼ばない）。
 *
 * extend=false: スライディング延長（Redis TTL 更新 + Cookie 再発行）を抑止する。
 * セッションを同一レスポンスで失効させるルート（アカウント削除など）から呼ぶ用。
 * これを付けないと「延長 Cookie（maxAge=10日）」と「ルート側の失効 Cookie（maxAge=0）」が
 * 同じ ts_session に二重で載り、どちらが勝つか曖昧になる（純粋 read のつもりの getter が
 * Cookie を書く副作用と、ルートの明示失効の衝突）。失効が目的のルートでは延長しない。
 */
export async function getUserIdFromSession(
  request: NextRequest,
  { extend = true }: { extend?: boolean } = {},
): Promise<string | null> {
  const token = request.cookies.get(TS_SESSION_COOKIE)?.value
  if (!token) return null
  const data = await redisGet<UserSessionData>(userSessionKey(token))
  if (!data) return null

  const now = Date.now()
  if (extend && (data.expiresAt == null || data.expiresAt - now < SESSION_REFRESH_THRESHOLD_MS)) {
    const renewed: UserSessionData = { ...data, expiresAt: now + SESSION_EXPIRY * 1000 }
    await redisSet(userSessionKey(token), renewed, SESSION_EXPIRY)
    const store = await cookies()
    store.set(TS_SESSION_COOKIE, token, sessionCookieOptions())
  }
  return data.userId
}

/** セッションを削除（ログアウト用） */
export async function deleteUserSession(token: string): Promise<boolean> {
  return redisDelete(userSessionKey(token))
}

/** Cookie に載せるオプション（Secure は本番のみ） */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: ENV === "production" || ENV === "preview",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_EXPIRY,
  }
}
