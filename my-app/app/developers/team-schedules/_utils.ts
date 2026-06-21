import type { LolRoleFlags } from "@/app/_domains/teamSchedules/types"

/** can-play な LoL ロールを表示用に整形する（無ければ "—"） */
export function formatRoles(roles: LolRoleFlags): string {
  const labels: [keyof LolRoleFlags, string][] = [
    ["top", "TOP"],
    ["jungle", "JG"],
    ["mid", "MID"],
    ["adc", "ADC"],
    ["support", "SUP"],
  ]
  const enabled = labels.filter(([k]) => roles[k]).map(([, label]) => label)
  return enabled.length > 0 ? enabled.join(" / ") : "—"
}

/** ISO 文字列を「YYYY-MM-DD HH:mm」のローカル表記に整形する（不正値はそのまま返す） */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Discord ID 配列を表示用に整形する（無ければ "（紐づけ無し）"） */
export function formatDiscordIds(ids: string[]): string {
  return ids.length > 0 ? ids.join(", ") : "（紐づけ無し）"
}
