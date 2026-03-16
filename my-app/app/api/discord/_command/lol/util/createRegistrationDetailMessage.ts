import { RegisteredTeamData, ProtectMatchMeta, TeamSide } from "@/app/domains/lol/types"
import { arrayUnorderedEqual } from "../../../_util/arrayUnorderedEqual"

/**
 * 登録内容の詳細メッセージを生成（ephemeral 用）
 */
export function createRegistrationDetailMessage(teamSide: TeamSide, meta: ProtectMatchMeta, teamData: RegisteredTeamData): string | undefined {
  const lines: string[] = []

  // ヘッダー
  lines.push(teamSide === "blue_team" ? "✅ ブルーサイド登録完了" : "✅ レッドサイド登録完了")
  lines.push("")

  // プロテクト
  if (meta.rules.isProtect && teamData.protection_champions) {
    lines.push("【プロテクト】")
    lines.push(teamData.protection_champions)
    lines.push("")
  }

  // ロール振り分け
  if (meta.rules.isRoleSelect && teamData.roster) {
    const metaTeamMembers = teamSide === "blue_team" ? meta.members?.blueTeam : meta.members?.redTeam
    const rosterValues = Object.values(teamData.roster)
    if (metaTeamMembers && !arrayUnorderedEqual(rosterValues, metaTeamMembers)) {
      return undefined
    }

    lines.push("【ロール振り分け】")
    lines.push(`TOP: ${teamData.roster.top}`)
    lines.push(`JG: ${teamData.roster.jg}`)
    lines.push(`MID: ${teamData.roster.mid}`)
    lines.push(`ADC: ${teamData.roster.adc}`)
    lines.push(`SUP: ${teamData.roster.sup}`)
  }

  return lines.join("\n")
}
