import { TeamData, OrderedTeamData } from "@/app/_domains/fighting/types"

export const isOrderedTeamData = (team: TeamData | undefined): team is OrderedTeamData => {
  return !!team?.order && !!team?.updatedAt
}
