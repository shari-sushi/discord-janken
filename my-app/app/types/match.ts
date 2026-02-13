/**
 * プロテクト機能 - チームデータ
 */
export type ProtectTeamData = {
  protection_champions: string
  updated_at: string // ISO 8601
  // 将来実装: memberRoles?: { top: string; jg: string; mid: string; adc: string; sup: string }
}

/**
 * プロテクト機能 - 試合メタデータ
 */
export type ProtectMatchMeta = {
  match_id: string
  created_at: string // ISO 8601
  // 将来実装: members?: string[]
}

/**
 * Redisキー生成ヘルパー関数の型
 */
export type MatchKeyType = "red_team" | "blue_team" | "meta"
