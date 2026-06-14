/**
 * スクリム調整機能 - 認可ヘルパー
 *
 * - getSessionUserId: Cookie → session → userId（未認証は null）
 * - assertTeamMember / assertTeamAdmin: team_members を引いて role 判定
 *
 * 秘匿が必要な場面（非メンバーが書き込みを試みる等）は、リソースの存在を隠すため
 * 呼び出し側で 404 を返す（coding-standards.md）。
 */

import { and, eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { db } from "@/app/_server/lib/db"
import { discordLinks, teamMembers } from "./schema"
import { getUserIdFromSession } from "./session"
import { TEAM_SCHEDULE_CREATOR_DISCORD_IDS } from "@/app/_server/lib/env"

/** ENV の許可 Discord ID（カンマ区切り）を Set 化（空要素は除外） */
const creatorDiscordIds = new Set(
  TEAM_SCHEDULE_CREATOR_DISCORD_IDS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
)

/** ログイン中ユーザーID（未認証は null） */
export async function getSessionUserId(request: NextRequest): Promise<string | null> {
  return getUserIdFromSession(request)
}

/** (teamId, userId) が team_members に存在するか（＝そのチームの編集権がある人か） */
export async function assertTeamMember(teamId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1)
  return rows.length > 0
}

/**
 * このユーザーがチームを作成できるか。
 * 紐づく Discord ID のいずれかが ENV の許可リストに含まれていれば true。
 */
export async function canCreateTeam(userId: string): Promise<boolean> {
  if (creatorDiscordIds.size === 0) return false
  const rows = await db.select({ discordUserId: discordLinks.discordUserId }).from(discordLinks).where(eq(discordLinks.userId, userId))
  return rows.some((r) => creatorDiscordIds.has(r.discordUserId))
}

/** (teamId, userId) が admin ロールか */
export async function assertTeamAdmin(teamId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ teamRole: teamMembers.teamRole })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1)
  return rows[0]?.teamRole === "admin"
}
