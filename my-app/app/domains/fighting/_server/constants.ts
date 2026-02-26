import { TeamFormat, TeamOrderData } from "@/app/domains/fighting/types"

// フォーマットごとの出場順ポジション定義
export const TEAM_FORMAT_POSITIONS: Record<TeamFormat, Array<keyof TeamOrderData>> = {
  "2v2": ["vanguard", "general"],
  "3v3": ["vanguard", "middle", "general"],
  "5v5": ["vanguard", "second", "middle", "fourth", "general"],
}

// ポジション名を日本語表記で取得
export const getPositionLabel = (position: keyof TeamOrderData): string => {
  const labels: Record<keyof TeamOrderData, string> = {
    vanguard: "先鋒",
    second: "次鋒",
    middle: "中堅",
    fourth: "副将",
    general: "大将",
  }
  return labels[position]
}
