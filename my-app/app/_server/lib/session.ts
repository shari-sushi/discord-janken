import { randomBytes } from "crypto"
import { redisGet, redisSet, redisDelete } from "./redis/redis"

const SESSION_PREFIX = "session:"
// 開発者/管理者用は強権限（Redis CRUD 管理UI）のため、絶対有効期限（発行から3日で必ず失効）。
// アクセスでは延長しない（＝スライディングしない）。盗用時の最大被害時間を3日に固定する狙い。
const SESSION_EXPIRY = 60 * 60 * 24 * 3 // 3 days in seconds

export interface SessionData {
  username: string
  createdAt: number
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex")
}

export async function createSession(username: string): Promise<string> {
  const token = generateSessionToken()
  const sessionData: SessionData = {
    username,
    createdAt: Date.now(),
  }

  await redisSet(
    `${SESSION_PREFIX}${token}`,
    sessionData,
    SESSION_EXPIRY
  )

  return token
}

export async function validateSession(token: string): Promise<boolean> {
  if (!token) {
    return false
  }

  // 絶対有効期限のため TTL は延長しない（存在確認のみ。Redis の TTL 失効＝ログアウト）。
  const sessionData = await redisGet<SessionData>(`${SESSION_PREFIX}${token}`)
  return sessionData !== null
}

export async function deleteSession(token: string): Promise<boolean> {
  return await redisDelete(`${SESSION_PREFIX}${token}`)
}
