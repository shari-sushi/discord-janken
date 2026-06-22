import { randomBytes } from "crypto"
import { redisSet } from "@/app/_server/lib/redis/redis"
import { magicLinkKey } from "@/app/_domains/teamSchedules/_server/redisKeys"
import { APP_URL } from "@/app/_server/lib/env"

/** magic-link の有効期限（秒）。発行・検証・案内文の表示で共有する */
export const MAGIC_LINK_TTL = 600 // 10分

/** Redis に保存する magic-link の中身（auth/verify で利用） */
export type MagicLinkPayload = {
  discordUserId: string
  username: string
}

/**
 * ワンタイムのログイン用URLを発行する（トークン生成 + Redis保存）。
 * URL を知れば誰でもそのユーザーとしてログインできるため、必ず本人にだけ届く
 * ephemeral メッセージで提示すること。
 *
 * teamId を渡すと `?token=...&team=...` を付け、ログイン後に対象チームを
 * 自チーム選択した状態で開く（team_schedules 画面が token を消費しつつ team は残す）。
 */
export async function createMagicLinkUrl(discordUserId: string, username: string, teamId?: string): Promise<string> {
  const token = randomBytes(32).toString("hex")
  const payload: MagicLinkPayload = { discordUserId, username }
  await redisSet(magicLinkKey(token), payload, MAGIC_LINK_TTL)

  const url = `${APP_URL}/team_schedules?token=${token}`
  return teamId ? `${url}&team=${encodeURIComponent(teamId)}` : url
}
