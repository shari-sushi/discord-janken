import { TeamData, OrderedTeamData } from "@/app/domains/fighting/types"

export const isOrderedTeamData = (team: TeamData | undefined): team is OrderedTeamData => {
  return !!team?.order && !!team?.updatedAt
}
