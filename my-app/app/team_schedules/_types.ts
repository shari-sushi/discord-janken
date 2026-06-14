import type { ScheduleStatus } from "@/app/_domains/teamSchedules/types"

/** グリッドのセル表示状態。未記入(none)を含む4状態 */
export type CellStatus = ScheduleStatus | "none"

/** グリッド行に対応する日付情報（UI固有） */
export type DateCell = {
  /** YYYY-MM-DD */
  key: string
  /** 表示ラベル（例: 6/16） */
  label: string
  /** 曜日（日〜土） */
  weekday: string
  isSunday: boolean
  isSaturday: boolean
}

/** 比較対象として選択中のチーム構成（自チーム + 相手チーム複数） */
export type ComparisonSelection = {
  ownTeamId: string | null
  opponentTeamIds: string[]
}

/** セル1個の表示内容 */
export type CellView = {
  status: CellStatus
  note: string
}

/**
 * グリッドの1列ぶんのビューモデル。
 * 自メンバー列・相手チーム列で共通。セルは day(YYYY-MM-DD) で引く。
 */
export type ScheduleColumn = {
  /** 列の一意ID */
  id: string
  /** 列見出し */
  label: string
  kind: "own-member" | "opponent"
  teamId: string
  /** 編集対象のユーザーID（自メンバー列=そのメンバー / 相手列=ログインユーザー）。編集不可なら null */
  editTargetUserId: string | null
  editable: boolean
  /** 日付ごとのセル内容 */
  cells: Map<string, CellView>
}

/** グリッドの1行ぶん（日付）の集計ビューモデル */
export type GridRow = {
  date: DateCell
  /** 自チームの ok 数 */
  okCount: number
  /** 自チームの maybe 数 */
  maybeCount: number
  /** 自チームの所属人数 */
  memberCount: number
  /** 自チームが活動可能（ok数 >= 必要人数） */
  ownActive: boolean
  /** 自チームの詰み（行を薄くする） */
  impossible: boolean
  /** 成立（自チーム活動可能 かつ 相手のいずれかが活動可能） */
  success: boolean
}
