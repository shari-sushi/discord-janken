import { ProtectMatchMeta, RegisteredTeamData, TeamSide } from "@/app/domains/lol/types"
import { arrayUnorderedEqual } from "../../../util/arrayUnorderedEqual"

/**
 * 片方のチーム登録完了時のメッセージを生成（エフェメラル用）
 */
export const createSingleTeamRegistrationMessage = (teamSide: TeamSide, meta: ProtectMatchMeta, teamData: RegisteredTeamData): { content: string } | undefined => {
  const lines: string[] = []

  // タイトル行
  lines.push(teamSide === "blue_team" ? "✅ ブルーサイド登録完了" : "✅ レッドサイド登録完了")

  // プロテクト行（isProtect が true の場合のみ）
  if (meta.rules.isProtect && teamData.protection_champions) {
    lines.push(`プロテクト：${teamData.protection_champions}`)
  }

  // ロール行（isRoleSelect が true の場合のみ）
  if (meta.rules.isRoleSelect && teamData.roster) {
    const metaTeamMembers = teamSide === "blue_team" ? meta.members?.blueTeam : meta.members?.redTeam
    const rosterValues = Object.values(teamData.roster)
    if (metaTeamMembers && !arrayUnorderedEqual(rosterValues, metaTeamMembers)) {
      return undefined
    }

    lines.push(`TOP：${teamData.roster.top}`)
    lines.push(`JG：${teamData.roster.jg}`)
    lines.push(`MID：${teamData.roster.mid}`)
    lines.push(`ADC：${teamData.roster.adc}`)
    lines.push(`SUP：${teamData.roster.sup}`)
  }

  return {
    content: lines.join("\n"),
  }
}
