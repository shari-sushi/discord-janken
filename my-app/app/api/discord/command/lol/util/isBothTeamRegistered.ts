import { MatchRules, TeamData } from "@/app/domains/lol/types"

export const isBothTeamRegistered = (rules: MatchRules, team1: TeamData | undefined, team2: TeamData | undefined) => {
  if (team1 == null || team2 == null) {
    return false
  }

  if (rules.isProtect) {
    if (team1.protection_champions == "" || team2.protection_champions == "") {
      return false
    }
  }

  if (rules.isRoleSelect) {
    if (team1.roster?.top == "" || team1.roster?.jg == "" || team1.roster?.mid == "" || team1.roster?.adc == "" || team1.roster?.sup == "") {
      return false
    }
    if (team2.roster?.top == "" || team2.roster?.jg == "" || team2.roster?.mid == "" || team2.roster?.adc == "" || team2.roster?.sup == "") {
      return false
    }
  }

  return true
}
