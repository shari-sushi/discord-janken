/**
 * スクリム調整機能 - チーム間スケジュール相互共有（#175）
 *
 * 共有関係（team_shares）の問い合わせと共有トークンの発行を集約する。
 * authz.ts（=(team,user) の直接認可）とは責務を分け、invites.ts と同列に置く。
 *
 * 不変条件: あるユーザーが読めるスケジュール = 所属チーム ∪ その所属チームと共有しているチーム。
 * 共有は対称(A↔B)かつ非推移(A-B・B-C があっても A-C は見えない)。
 * team_shares は順序づけペア（team_low < team_high）で 1共有=1行。
 */

import { randomBytes } from "crypto"
import { and, eq, inArray, or } from "drizzle-orm"
import { db } from "@/app/_server/lib/db"
import { teamMembers, teamShares } from "./schema"
import { shareKey } from "./redisKeys"
import { redisSet } from "@/app/_server/lib/redis/redis"

/** 共有トークンの有効期限（招待リンクと同型・7日） */
export const SHARE_TTL = 60 * 60 * 24 * 7

/** Redis に保存する共有トークンの中身（shares POST で利用） */
export type SharePayload = {
  /** 共有を申し込んだ側（リンク発行元）のチーム */
  sourceTeamId: string
}

/** 2つの teamId を team_low < team_high に正規化する（(A,B)=(B,A) を一意化） */
export function orderPair(a: string, b: string): { teamLow: string; teamHigh: string } {
  return a < b ? { teamLow: a, teamHigh: b } : { teamLow: b, teamHigh: a }
}

/**
 * 共有トークンを発行して Redis に保存し、トークン文字列を返す。
 * 成立させた受諾側 userId は team_shares.created_by に記録するため、トークンには発行者を持たせない。
 * @param sourceTeamId 共有を申し込む側（リンク発行元）のチーム
 */
export async function createShareToken(sourceTeamId: string): Promise<string> {
  // invites.createInviteToken と同型。16バイト=128bit=32文字で 7日TTL には十分な強度。
  const token = randomBytes(16).toString("hex")
  const payload: SharePayload = { sourceTeamId }
  await redisSet(shareKey(token), payload, SHARE_TTL)
  return token
}

/** あるチームが共有している相手チームの teamId 一覧（双方向 OR で 1 SELECT） */
export async function getSharePartners(teamId: string): Promise<string[]> {
  const rows = await db
    .select({ teamLow: teamShares.teamLow, teamHigh: teamShares.teamHigh })
    .from(teamShares)
    .where(or(eq(teamShares.teamLow, teamId), eq(teamShares.teamHigh, teamId)))
  return rows.map((r) => (r.teamLow === teamId ? r.teamHigh : r.teamLow))
}

/**
 * 複数チームの共有相手を 1 往復でまとめて引く（GET /teams 用）。
 * 戻り値は teamId → 共有相手 teamId[] の Map（共有0件のチームはキーを持たない）。
 */
export async function getSharePartnersForTeams(teamIds: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>()
  if (teamIds.length === 0) return result
  const rows = await db
    .select({ teamLow: teamShares.teamLow, teamHigh: teamShares.teamHigh })
    .from(teamShares)
    .where(or(inArray(teamShares.teamLow, teamIds), inArray(teamShares.teamHigh, teamIds)))
  const idSet = new Set(teamIds)
  // 1行(team_low, team_high)につき、自分側=key / 反対側=partner に振り分ける。
  // 両方が teamIds に含まれる（自分の所属2チーム同士の共有）場合は双方向に積む。
  const push = (key: string, partner: string) => {
    const list = result.get(key)
    if (list) list.push(partner)
    else result.set(key, [partner])
  }
  for (const r of rows) {
    if (idSet.has(r.teamLow)) push(r.teamLow, r.teamHigh)
    if (idSet.has(r.teamHigh)) push(r.teamHigh, r.teamLow)
  }
  return result
}

/** userId が所属している全チームの teamId 一覧（可視性判定の起点） */
export async function getUserTeamIds(userId: string): Promise<string[]> {
  const rows = await db.select({ teamId: teamMembers.teamId }).from(teamMembers).where(eq(teamMembers.userId, userId))
  return rows.map((r) => r.teamId)
}

/**
 * 可視判定の純粋ロジック（#175 の核心・非推移をここで担保）。
 * 直接所属している、または対象チームの【直接の】共有相手に自分の所属チームが含まれれば可視。
 * 対象の共有相手のさらに共有相手（2ホップ）は見ないので、A-B・B-C があっても A から C は不可視。
 *
 * @param myTeamIds 判定するユーザーの所属チーム
 * @param targetTeamId 閲覧したい対象チーム
 * @param targetSharePartners 対象チームが直接共有している相手チーム（getSharePartners(targetTeamId) の結果）
 */
export function isTeamVisible(myTeamIds: string[], targetTeamId: string, targetSharePartners: string[]): boolean {
  if (myTeamIds.includes(targetTeamId)) return true // 直接所属
  return targetSharePartners.some((p) => myTeamIds.includes(p)) // 対象と直接共有しているチームに所属
}

/**
 * userId が teamId のスケジュールを閲覧してよいか（schedule GET の可視性ガード用）。
 * 直接所属なら共有照会を省いて即 true（最適化）。そうでなければ対象の直接共有相手を1ホップだけ引いて判定する。
 * 判定の本体は純粋関数 isTeamVisible に切り出し、非推移の不変条件を単体テストで固定する。
 */
export async function isTeamVisibleTo(teamId: string, userId: string): Promise<boolean> {
  const myTeamIds = await getUserTeamIds(userId)
  if (myTeamIds.includes(teamId)) return true // 直接所属なら getSharePartners を省く
  const partners = await getSharePartners(teamId)
  return isTeamVisible(myTeamIds, teamId, partners)
}

/** team_shares から共有を1行削除する（解除・冪等）。順序正規化して PK で1行を指す */
export async function deleteShare(teamA: string, teamB: string): Promise<void> {
  const { teamLow, teamHigh } = orderPair(teamA, teamB)
  await db.delete(teamShares).where(and(eq(teamShares.teamLow, teamLow), eq(teamShares.teamHigh, teamHigh)))
}
