// Redisキーを生成
export const getMetaKey = (matchId: string): string => {
  return `fighting:team-order:${matchId}:meta`
}

export const getTeamKey = (matchId: string, teamNumber: 1 | 2): string => {
  return `fighting:team-order:${matchId}:team:${teamNumber}`
}
