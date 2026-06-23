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
import { hasAdminAuthority, MAX_TEAMS_PER_USER, type TeamRole } from "@/app/_domains/teamSchedules/types"
import { getUserIdFromSession } from "./session"
import { getUserTeamIds } from "./shares"
import { TEAM_SCHEDULE_CREATOR_DISCORD_IDS } from "@/app/_server/lib/env"

/** ENV の許可 Discord ID（カンマ区切り）を Set 化（空要素は除外） */
const creatorDiscordIds = new Set(
  TEAM_SCHEDULE_CREATOR_DISCORD_IDS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
)

/**
 * ログイン中ユーザーID（未認証は null）。
 * extend=false でスライディング延長（Cookie 再発行）を抑止する。
 * セッションを失効させるルート（アカウント削除など）は延長 Cookie とルートの
 * 失効 Cookie が衝突しないよう extend:false で呼ぶこと。
 */
export async function getSessionUserId(
  request: NextRequest,
  opts?: { extend?: boolean },
): Promise<string | null> {
  return getUserIdFromSession(request, opts)
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

/** getTeamMembershipWithSuspension の戻り値 */
export type TeamMembershipWithSuspension = {
  /** 利用停止中か（users.suspended）。非メンバーでも必ず取れる */
  suspended: boolean
  /** チーム内ロール（非メンバーは null） */
  teamRole: TeamRole | null
}

/**
 * (teamId, userId) のチーム内ロールと、そのユーザーの利用停止状態を「1クエリ」で返す（#166）。
 *
 * このアプリはインフラ都合で1クエリごとにコネクションを貼り直すため DB 往復が高コスト。
 * 書き込み系 API では従来 isUserSuspended（users）と getTeamRole/assertTeamMember/assertTeamAdmin
 * （team_members）で2往復していたのを、users を基点に team_members を LEFT JOIN して1往復に畳む。
 *
 * users 起点の LEFT JOIN なので、非メンバーでも suspended は必ず取れる（teamRole だけ null になる）。
 * 呼び出し側は「suspended → 403」を先に、「teamRole → 404/400」を必要な箇所で判定すれば、
 * 従来と同じ順序・レスポンスを保てる（ロール判定は getTeamRole 等と同じ意味）。
 */
export async function getTeamMembershipWithSuspension(teamId: string, userId: string): Promise<TeamMembershipWithSuspension> {
  const rows = await db
    .select({ suspended: users.suspended, teamRole: teamMembers.teamRole })
    .from(users)
    .leftJoin(teamMembers, and(eq(teamMembers.userId, users.userId), eq(teamMembers.teamId, teamId)))
    .where(eq(users.userId, userId))
    .limit(1)
  const row = rows[0]
  return { suspended: row?.suspended === true, teamRole: row?.teamRole ?? null }
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
 * このユーザーが「チーム数の上限を無視できる」許可ユーザーか（運用保険／開発者用）。
 * 紐づく Discord ID のいずれかが ENV の許可リストに含まれていれば true。
 * 通常ユーザーは全員 false で、MAX_TEAMS_PER_USER の上限内でのみ作成・参加できる。
 */
export async function isAllowlistedCreator(userId: string): Promise<boolean> {
  if (creatorDiscordIds.size === 0) return false
  const rows = await db.select({ discordUserId: discordLinks.discordUserId }).from(discordLinks).where(eq(discordLinks.userId, userId))
  return rows.some((r) => creatorDiscordIds.has(r.discordUserId))
}

/**
 * このユーザーが新しくチームを作成できるか。
 * 所属チーム数（master + member 合算）が上限未満なら誰でも可。
 * 上限に達していても、許可リストのユーザーは作成できる（抜け道）。
 */
export async function canCreateTeam(userId: string): Promise<boolean> {
  const teamIds = await getUserTeamIds(userId)
  if (teamIds.length < MAX_TEAMS_PER_USER) return true
  return isAllowlistedCreator(userId) // 上限到達でも許可ユーザーは通す
}

/**
 * このユーザーが teamId のチームに参加できるか。
 * 既に当該チームに所属していれば冪等で常に許可（再参加 OK）。
 * 未所属なら所属チーム数が上限未満で可。上限到達でも許可ユーザーは通す。
 */
export async function canJoinTeam(userId: string, teamId: string): Promise<boolean> {
  const teamIds = await getUserTeamIds(userId)
  if (teamIds.includes(teamId)) return true // 既に所属＝冪等再参加 OK
  if (teamIds.length < MAX_TEAMS_PER_USER) return true
  return isAllowlistedCreator(userId)
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
