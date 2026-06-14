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
import type { NextRequest } from "next/server"
import { redisGet, redisSet, redisDelete } from "@/app/_server/lib/redis/redis"
import { userSessionKey } from "./redisKeys"
import { ENV } from "@/app/_server/lib/env"

/** Cookie 名（開発者用とは別物） */
export const TS_SESSION_COOKIE = "ts_session"

const SESSION_EXPIRY = 60 * 60 * 24 * 30 // 30 days in seconds

export interface UserSessionData {
  userId: string
  createdAt: number
}

function generateSessionToken(): string {
  return randomBytes(32).toString("hex")
}

/** セッションを作成し、トークンを返す（呼び出し側で Cookie に載せる） */
export async function createUserSession(userId: string): Promise<string> {
  const token = generateSessionToken()
  const data: UserSessionData = { userId, createdAt: Date.now() }
  await redisSet(userSessionKey(token), data, SESSION_EXPIRY)
  return token
}

/** リクエストの Cookie からログイン中ユーザーIDを解決する（未認証は null） */
export async function getUserIdFromSession(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(TS_SESSION_COOKIE)?.value
  if (!token) return null
  const data = await redisGet<UserSessionData>(userSessionKey(token))
  return data?.userId ?? null
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
