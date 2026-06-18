"use client"

import type { CellStatus, GridRow, ScheduleColumn } from "../_types"
import { makeCellHandlers, type CellCallbacks } from "../_utils"
import { ScheduleCell } from "./ScheduleCell"

type ScheduleDayCardsProps = {
  rows: GridRow[]
  threshold: number
  opponentColumns: ScheduleColumn[]
  memberColumns: ScheduleColumn[]
} & CellCallbacks

/** カードの枠色（成立 > 詰み > 通常）。ScheduleGrid の rowBgClass のカード版 */
function cardClass(row: GridRow): string {
  if (row.success) return "border-emerald-700/60 bg-emerald-900/20"
  if (row.impossible) return "border-zinc-800 bg-zinc-950 opacity-70"
  return "border-zinc-700 bg-zinc-900"
}

/** 1列ぶんの「見出し + セル」。表のセルを縦積みカード用に並べ直したもの */
function ColumnCell({ col, day, dimOnNg, callbacks }: { col: ScheduleColumn; day: string; dimOnNg: boolean; callbacks: CellCallbacks }) {
  const view = col.cells.get(day) ?? { status: "none" as CellStatus, note: "" }
  const handlers = makeCellHandlers(col, day, view.status, callbacks)
  return (
    <div className="flex w-16 flex-col items-center gap-1">
      <span className="max-w-full truncate text-[11px] text-zinc-400" title={col.label}>
        {col.label}
      </span>
      <ScheduleCell status={view.status} note={view.note} editable={col.editable} dim={dimOnNg && view.status === "ng"} onCycle={handlers.onCycle} onNoteChange={handlers.onNoteChange} />
    </div>
  )
}

/**
 * スマホ向け: 1日 = 1カードの縦積み表示。
 * ScheduleGrid と同じ view（rows / 列 / コールバック）を、横スクロール不要なレイアウトで描画する。
 */
export function ScheduleDayCards({ rows, threshold, opponentColumns, memberColumns, onCycle, onNoteChange, onTeamCycle, onTeamNoteChange }: ScheduleDayCardsProps) {
  const callbacks: CellCallbacks = { onCycle, onNoteChange, onTeamCycle, onTeamNoteChange }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const d = row.date
        const day = d.key
        // 祝日は日曜と同じ扱い（赤系）。祝日名はツールチップで補足する
        const wkColor = d.isSunday || d.isHoliday ? "text-rose-400" : d.isSaturday ? "text-sky-400" : "text-zinc-100"
        return (
          <div key={day} className={"rounded-lg border px-3 py-2.5 " + cardClass(row)}>
            {/* ヘッダー: 日付・曜日 / ○数 / 成立 */}
            <div className="flex items-center gap-2">
              <span className={"text-base font-bold " + wkColor} title={d.holidayName ?? undefined}>
                {d.label}
                <span className="ml-0.5 text-xs font-medium">({d.weekday})</span>
              </span>
              {/* 自チームが活動可能な日は「活動可」を明示（成立=相手も一致 とは別軸。塗りの成立バッジと区別してアウトライン表示） */}
              {row.ownActive && <span className="rounded border border-emerald-600 px-1 py-px text-[10px] font-bold text-emerald-400">活動可</span>}
              <span className={"ml-auto text-sm font-bold " + (row.okCount >= threshold ? "text-emerald-400" : "text-zinc-500")}>
                ○{row.okCount}
                {row.maybeCount > 0 && <span className="ml-0.5 text-xs font-normal text-amber-500">+{row.maybeCount}△</span>}
              </span>
              {row.success && <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">成立</span>}
            </div>

            {/* 相手チーム */}
            {opponentColumns.length > 0 && (
              <div className="mt-2 border-t border-zinc-800 pt-2">
                <p className="mb-1 text-[11px] font-semibold text-zinc-500">相手チーム</p>
                <div className="flex flex-wrap gap-2">
                  {opponentColumns.map((col) => (
                    <ColumnCell key={col.id} col={col} day={day} dimOnNg callbacks={callbacks} />
                  ))}
                </div>
              </div>
            )}

            {/* メンバー（members モード）/ チーム（team モード） */}
            {memberColumns.length > 0 && (
              <div className="mt-2 border-t border-zinc-800 pt-2">
                <p className="mb-1 text-[11px] font-semibold text-zinc-500">メンバー</p>
                <div className="flex flex-wrap gap-2">
                  {memberColumns.map((col) => (
                    <ColumnCell key={col.id} col={col} day={day} dimOnNg={false} callbacks={callbacks} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
