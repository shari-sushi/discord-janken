/**
 * スクリム調整機能 - Redis キー生成
 *
 * キー空間を機能ごとに分離する。開発者/管理者用セッション（`session:`）とは
 * 衝突しないよう、すべて `ts-` / `ts:` を prefix に持たせる。
 */

/** magic-link ワンタイムトークン（TTL 600s・単回使用）。値は { discordUserId, username } */
export function magicLinkKey(token: string): string {
  return `ts:magic:${token}`
}

/** 利用者セッション（開発者用 `session:` とはキー空間を分離） */
export function userSessionKey(token: string): string {
  return `ts-session:${token}`
}

/** チーム招待トークン（TTL付き・複数人利用可）。値は { teamId } */
export function inviteKey(token: string): string {
  return `ts:invite:${token}`
}

/** スケジュール共有トークン（TTL付き・受諾されても削除せず TTL で失効・#175）。値は { sourceTeamId } */
export function shareKey(token: string): string {
  return `ts:share:${token}`
}
