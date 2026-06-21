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
import { discordLinks, teamMembers, users } from "./schema"
import { hasAdminAuthority, type TeamRole } from "@/app/_domains/teamSchedules/types"
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

/**
 * このユーザーが利用停止（suspended）中か（#166）。
 * 書き込み系 API で「ログイン確認 → suspend なら 403」の判定に使う（読み取りは透過）。
 *
 * 適用範囲: 新規コンテンツ・参加を作る書き込み（チーム作成 / 参加 / 招待発行 / 予定・チーム状態の編集 /
 *   master移譲 / チーム設定編集・解散）はガード対象。一方、自己片付け（チーム脱退 = membership DELETE /
 *   アカウント削除 = account DELETE）は suspend 中でも許可する（footprint を減らす操作は止めない方針）。
 */
export async function isUserSuspended(userId: string): Promise<boolean> {
  const rows = await db.select({ suspended: users.suspended }).from(users).where(eq(users.userId, userId)).limit(1)
  return rows[0]?.suspended === true
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

/**
 * (teamId, userId) のチーム内ロールを返す（非メンバーは null）。
 * 「非メンバー＝404 / メンバーだが権限不足＝400」のように、メンバーシップと
 * ロールを区別して扱いたい呼び出し側のための関数。
 */
export async function getTeamRole(teamId: string, userId: string): Promise<TeamRole | null> {
  const rows = await db
    .select({ teamRole: teamMembers.teamRole })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1)
  return rows[0]?.teamRole ?? null
}

/** (teamId, userId) が admin 相当以上（master または admin）の管理権限を持つか */
export async function assertTeamAdmin(teamId: string, userId: string): Promise<boolean> {
  const role = await getTeamRole(teamId, userId)
  return role !== null && hasAdminAuthority(role)
}

/** (teamId, userId) が master ロールか（master 専用操作の判定用） */
export async function assertTeamMaster(teamId: string, userId: string): Promise<boolean> {
  return (await getTeamRole(teamId, userId)) === "master"
}
