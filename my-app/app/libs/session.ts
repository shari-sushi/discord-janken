import { randomBytes } from "crypto"
import { redisGet, redisSet, redisDelete } from "./redis/redis"

const SESSION_PREFIX = "session:"
const SESSION_EXPIRY = 60 * 60 * 24 * 7 // 7 days in seconds

export interface SessionData {
  createdAt: number
  lastAccessedAt: number
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex")
}

export async function createSession(): Promise<string> {
  const token = generateSessionToken()
  const sessionData: SessionData = {
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
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

  const sessionData = await redisGet<SessionData>(`${SESSION_PREFIX}${token}`)

  if (!sessionData) {
    return false
  }

  // セッションの最終アクセス時刻を更新
  sessionData.lastAccessedAt = Date.now()
  await redisSet(
    `${SESSION_PREFIX}${token}`,
    sessionData,
    SESSION_EXPIRY
  )

  return true
}

export async function deleteSession(token: string): Promise<boolean> {
  return await redisDelete(`${SESSION_PREFIX}${token}`)
}
