// フォーマット型
export type TeamFormat = "2v2" | "3v3" | "5v5"

// 出場順データ型
export type TeamOrderData = {
  vanguard: string // 先鋒
  second?: string // 次鋒
  middle?: string // 中堅
  fourth?: string // 副将
  general: string // 大将
}

// メタデータ型（試合全体の管理情報のみ）redis管理
export type FightingTeamOrderMeta = {
  matchId: string
  format: TeamFormat
  createdAt: string
  channelId?: string
  messageId?: string
  guildId?: string
}

// チームデータ型（チーム名 + 登録状況）redis管理
export type TeamData = {
  teamName: string
  updatedAt?: string // 登録済みの場合のみ
  order?: TeamOrderData // 登録済みの場合のみ
}

// 登録済みチームデータ型
export type OrderedTeamData = Required<TeamData>
