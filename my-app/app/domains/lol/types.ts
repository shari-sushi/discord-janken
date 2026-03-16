/**
 * プロテクト機能 - チームデータ
 */
export type RegisteredTeamData = {
  updated_at: string // ISO 8601
} & TeamData

export type TeamData = {
  protection_champions?: string // isProtect: true の場合のみ存在
  roster?: Roster // isRoleSelect: trueの場合のみ存在
}

export type Roster = {
  // isRoleSelect: true の場合のみ存在
  top: string
  jg: string
  mid: string
  adc: string
  sup: string
}

/**
 * プロテクト機能 - 試合メタデータ
 */
export type ProtectMatchMeta = {
  match_id: string
  created_at: string // ISO 8601
  members?: MatchMembers
  rules: MatchRules
}

export type MatchRules = {
  isProtect: boolean // プロテクト機能の有無
  isRoleSelect: boolean // ロール選択機能の有無
}

export type MatchMembers = {
  // メンバーリスト（isRoleSelect: true の場合に推奨）
  blueTeam: string[] // ブルーチームのメンバー（5名）
  redTeam: string[] // レッドチームのメンバー（5名）
}

/**
 * Redisキー生成ヘルパー関数の型
 */
export type MatchKeyType = TeamSide | "meta"
export type TeamSide = "red_team" | "blue_team"
