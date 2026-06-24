import type { TeamMemberDetail, TeamRole } from "@/app/_domains/teamSchedules/types"
import type { SortDir, SortKey } from "./_types"

/** ロールの表示ラベル（日本語）。テーブルの「ロール」列に出す */
export const ROLE_LABEL: Record<TeamRole, string> = {
  master: "master",
  admin: "admin",
  member: "member",
}

/**
 * ロールの序列（小さいほど上位）。ソートの基準に使う。
 * master → admin → member の順に並べる。
 */
const ROLE_ORDER: Record<TeamRole, number> = {
  master: 0,
  admin: 1,
  member: 2,
}

/**
 * joinedAt（ISO 文字列）を JST の「YYYY/MM/DD」表記に整形する。
 * 不正な日付は元の文字列をそのまま返す（表示が壊れて空欄になるのを避ける）。
 */
export function formatJoinedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  // ロケール差で表記が揺れないよう、明示的に ja-JP・Asia/Tokyo で整形する
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo" }).format(d)
}

/**
 * メンバー配列を指定列・方向でソートした新しい配列を返す（非破壊）。
 * - name: displayName の文字列比較（ja ロケール）
 * - role: master → admin → member の序列
 * - joinedAt: 時刻の昇順/降順
 * 同値は元の順序（= サーバーの joinedAt 昇順）を保つよう、安定ソートの前提で第2キーは設けない。
 */
export function sortMembers(members: TeamMemberDetail[], key: SortKey, dir: SortDir): TeamMemberDetail[] {
  const sign = dir === "asc" ? 1 : -1
  return [...members].sort((a, b) => {
    let cmp = 0
    if (key === "name") {
      cmp = a.displayName.localeCompare(b.displayName, "ja")
    } else if (key === "role") {
      cmp = ROLE_ORDER[a.teamRole] - ROLE_ORDER[b.teamRole]
    } else {
      cmp = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
    }
    return cmp * sign
  })
}
