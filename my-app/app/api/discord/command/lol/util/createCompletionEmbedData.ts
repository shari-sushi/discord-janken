import { ProtectMatchMeta, ProtectTeamData } from "@/app/domains/lol/types"

/**
 * 両チーム完了時のEmbedデータを生成（3カラムテーブル形式）
 */
export const createCompletionEmbedData = (meta: ProtectMatchMeta, teamsData: { blue: ProtectTeamData; red: ProtectTeamData }) => {
  // 左カラム（項目名）の値を構築
  const leftColumnLines: string[] = []

  // 中央カラム（ブルーチーム）の値を構築
  const blueColumnLines: string[] = []

  // 右カラム（レッドチーム）の値を構築
  const redColumnLines: string[] = []

  // プロテクト行（isProtect が true の場合のみ）
  if (meta.isProtect && teamsData.blue.protection_champions && teamsData.red.protection_champions) {
    leftColumnLines.push("プロテクト    ")
    blueColumnLines.push(teamsData.blue.protection_champions)
    redColumnLines.push(teamsData.red.protection_champions)

    // protectとroleの間に改行を入れる
    if (meta.isRoleSelect) {
      leftColumnLines.push("\u200B")
      blueColumnLines.push("\u200B")
      redColumnLines.push("\u200B")
    }
  }

  // ロール行（isRoleSelect が true の場合のみ）
  if (meta.isRoleSelect && teamsData.blue.roster && teamsData.red.roster) {
    leftColumnLines.push("TOP", "JG", "MID", "ADC", "SUP")
    blueColumnLines.push(teamsData.blue.roster.top, teamsData.blue.roster.jg, teamsData.blue.roster.mid, teamsData.blue.roster.adc, teamsData.blue.roster.sup)
    redColumnLines.push(teamsData.red.roster.top, teamsData.red.roster.jg, teamsData.red.roster.mid, teamsData.red.roster.adc, teamsData.red.roster.sup)
  }

  // fieldsを構築
  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    {
      name: "\u200B",
      value: leftColumnLines.join("\n"),
      inline: true,
    },
    {
      name: "🟦ブルーサイド",
      value: blueColumnLines.join("\n"),
      inline: true,
    },
    {
      name: "🟥レッドサイド",
      value: redColumnLines.join("\n"),
      inline: true,
    },
  ]

  return {
    embeds: [
      {
        title: "✅ 結果発表",
        color: 3447003,
        fields,
      },
    ],
  }
}
