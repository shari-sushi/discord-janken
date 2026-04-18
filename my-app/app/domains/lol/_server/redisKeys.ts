import { MatchKeyType } from "@/app/domains/lol/types"

/**
 * プロテクト機能用のRedisキーを生成する
 * @param matchId 試合ID（UUID v4）
 * @param keyType キータイプ（red_team, blue_team, meta）
 * @returns Redisキー（例: "lol:matches:abc123:red_team"）
 */
export const getMatchKey = (matchId: string, keyType: MatchKeyType): string => {
  return `lol:matches:${matchId}:${keyType}`
}

/** op.gg マルチサーチ - 自チームメンバー */
export const SELF_TEAM_KEY = "lol:opgg:self-team"

/** op.gg マルチサーチ - 相手チーム一覧 */
export const ENEMY_TEAMS_KEY = "lol:opgg:enemy-teams"
