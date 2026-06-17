import type { ScheduleEntry, ScheduleStatus, TeamDayStatusEntry, TeamSchedule } from "@/app/_domains/teamSchedules/types"
import type { CellStatus, ComparisonSelection, DateCell } from "./_types"

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"]

/** 比較チーム選択を保存する localStorage キー（タブ間同期の storage イベント判定にも使う） */
export const SELECTION_STORAGE_KEY = "ts_comparison_selection"

/**
 * localStorage から比較チーム選択を読み込む。
 * SSR・localStorage不可・壊れたデータでは null を返す（呼び出し側は既定値で続行）。
 */
export function loadSelection(): ComparisonSelection | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(SELECTION_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    const { ownTeamId, opponentTeamIds } = parsed as Record<string, unknown>
    return {
      ownTeamId: typeof ownTeamId === "string" ? ownTeamId : null,
      opponentTeamIds: Array.isArray(opponentTeamIds) ? opponentTeamIds.filter((id): id is string => typeof id === "string") : [],
    }
  } catch {
    return null
  }
}

/** 比較チーム選択を localStorage に保存する（localStorage不可の環境では黙って諦める） */
export function saveSelection(selection: ComparisonSelection): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selection))
  } catch {
    // プライベートモードや容量超過では永続化を諦める（機能自体は動作する）
  }
}

/** セルのタップ循環順: 未記入 → ○ → △ → × → 未記入 */
const CYCLE: CellStatus[] = ["none", "ok", "maybe", "ng"]

/** 次の状態を返す（タップ循環） */
export function cycleStatus(current: CellStatus): CellStatus {
  const i = CYCLE.indexOf(current)
  return CYCLE[(i + 1) % CYCLE.length]
}

/** 各状態の表示設定（記号・色・ラベル） */
export const STATUS_STYLE: Record<CellStatus, { symbol: string; className: string; label: string }> = {
  none: { symbol: "–", className: "border border-zinc-600 bg-zinc-800 text-zinc-500", label: "未記入" },
  ok: { symbol: "○", className: "bg-emerald-500 text-white", label: "参加可" },
  maybe: { symbol: "△", className: "bg-amber-400 text-white", label: "検討中" },
  ng: { symbol: "×", className: "bg-rose-400 text-white", label: "不可" },
}

/** Date を YYYY-MM-DD（ローカル日付）に変換。TZ事故を避けるため UTC変換は使わない */
export function toDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** 開始日から numDays 日ぶんの日付セルを生成 */
export function buildDateRange(start: Date, numDays: number): DateCell[] {
  const cells: DateCell[] = []
  for (let i = 0; i < numDays; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const weekday = d.getDay()
    cells.push({
      key: toDayKey(d),
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      weekday: WEEKDAYS[weekday],
      isSunday: weekday === 0,
      isSaturday: weekday === 6,
    })
  }
  return cells
}

/**
 * チームの予定を userId → (day → entry) の二段Mapに索引化する。
 * セル描画時の O(1) 参照用。
 */
export function indexSchedules(schedules: ScheduleEntry[]): Map<string, Map<string, ScheduleEntry>> {
  const map = new Map<string, Map<string, ScheduleEntry>>()
  for (const s of schedules) {
    let byDay = map.get(s.userId)
    if (!byDay) {
      byDay = new Map()
      map.set(s.userId, byDay)
    }
    byDay.set(s.day, s)
  }
  return map
}

/** ある日のチーム集計 */
export type DayAggregate = {
  okCount: number
  maybeCount: number
  ngCount: number
  /** 所属人数（未記入は行が無いので team_members 基準で数える） */
  memberCount: number
  /** 活動可能: ok数 >= requiredCount */
  active: boolean
  /** 詰み: (所属人数 - ng数) < requiredCount（もう必要人数に届かない確定の日） */
  impossible: boolean
}

/** team_day_status を day → entry の Map に索引化する */
export function indexTeamStatus(entries: TeamDayStatusEntry[]): Map<string, TeamDayStatusEntry> {
  return new Map(entries.map((e) => [e.day, e]))
}

/**
 * 索引化済みの予定から、指定日のチーム集計を計算する。
 * team モードのチームは team_day_status の単一状態で判定する（ok=活動可能・ng=詰み）。
 */
export function aggregateDay(team: TeamSchedule, indexed: Map<string, Map<string, ScheduleEntry>>, day: string): DayAggregate {
  if (team.managementMode === "team") {
    const status = team.teamStatus.find((e) => e.day === day)?.status
    return {
      okCount: status === "ok" ? 1 : 0,
      maybeCount: status === "maybe" ? 1 : 0,
      ngCount: status === "ng" ? 1 : 0,
      memberCount: 1,
      active: status === "ok",
      impossible: status === "ng",
    }
  }

  let okCount = 0
  let maybeCount = 0
  let ngCount = 0
  for (const member of team.members) {
    const status = indexed.get(member.userId)?.get(day)?.status
    if (status === "ok") okCount++
    else if (status === "maybe") maybeCount++
    else if (status === "ng") ngCount++
  }
  const memberCount = team.members.length
  return {
    okCount,
    maybeCount,
    ngCount,
    memberCount,
    active: okCount >= team.requiredCount,
    impossible: memberCount - ngCount < team.requiredCount,
  }
}

/**
 * 相手チームを1列で表すための代表ステータスを導出する。
 * 相手チームは requiredCount=1・代表1人想定だが、複数人でも破綻しないように集約する。
 * 活動可能(○) > 検討中(△) > 不可(×) > 未記入(–) の優先で1記号にまとめる。
 */
export function summarizeTeamStatus(agg: DayAggregate): CellStatus {
  if (agg.active) return "ok"
  if (agg.maybeCount > 0) return "maybe"
  if (agg.ngCount > 0) return "ng"
  return "none"
}

/** ScheduleEntry の status を CellStatus に正規化（未記入 = entry無し = none） */
export function toCellStatus(entry: ScheduleEntry | undefined): CellStatus {
  return entry?.status ?? "none"
}

/** CellStatus を ScheduleStatus に変換（none は null） */
export function toScheduleStatus(status: CellStatus): ScheduleStatus | null {
  return status === "none" ? null : status
}
