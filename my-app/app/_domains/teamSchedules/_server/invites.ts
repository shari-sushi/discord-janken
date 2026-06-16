/**
 * スクリム調整機能 - 招待トークンの発行
 *
 * Web の招待リンク発行（teams/[teamId]/invite）と Discord の招待コマンドの
 * 双方から呼ぶ共通処理。トークンを Redis に TTL付きで保存する（複数人利用可・TTLで失効）。
 */

import { randomBytes } from "crypto"
import { inviteKey } from "./redisKeys"
import { redisSet } from "@/app/_server/lib/redis/redis"

export const INVITE_TTL = 60 * 60 * 24 * 7 // 7日

/** Redis に保存する招待の中身（join で利用） */
export type InvitePayload = {
  teamId: string
  /** 発行者の userId（将来の発行者別一覧/失効 #108 のために任意で保持） */
  invitedBy?: string
}

/**
 * 招待トークンを発行して Redis に保存し、トークン文字列を返す。
 * @param teamId 参加先チーム
 * @param invitedBy 発行者の userId（省略可）
 */
export async function createInviteToken(teamId: string, invitedBy?: string): Promise<string> {
  const token = randomBytes(32).toString("hex")
  const payload: InvitePayload = invitedBy ? { teamId, invitedBy } : { teamId }
  await redisSet(inviteKey(token), payload, INVITE_TTL)
  return token
}
