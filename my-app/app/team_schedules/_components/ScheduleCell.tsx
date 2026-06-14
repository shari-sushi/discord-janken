"use client"

import type { CellStatus } from "../_types"
import { STATUS_STYLE } from "../_utils"

type ScheduleCellProps = {
  status: CellStatus
  note: string
  editable: boolean
  /** セルだけ薄く（相手の不可セルなど） */
  dim?: boolean
  onCycle?: () => void
  onNoteChange?: (value: string) => void
}

/** 状態トグルボタン + 時間メモ欄のセル */
export function ScheduleCell({ status, note, editable, dim = false, onCycle, onNoteChange }: ScheduleCellProps) {
  const style = STATUS_STYLE[status]

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={editable ? onCycle : undefined}
        disabled={!editable}
        aria-label={style.label}
        className={
          "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 " +
          style.className +
          (editable ? " cursor-pointer hover:opacity-80" : " cursor-default") +
          (dim ? " opacity-40" : "")
        }
      >
        {style.symbol}
      </button>
      {editable ? (
        // 状態が未記入のうちはメモを保存する行が無いため、入力欄を非活性にする
        // （○/△/× を付けてから時間を書く運用。none のまま打っても破棄されるのを防ぐ）
        <input
          value={note}
          onChange={(e) => onNoteChange?.(e.target.value)}
          disabled={status === "none"}
          placeholder="時間"
          className={
            "mt-1 w-14 rounded border border-slate-200 px-1 py-0.5 text-center text-[11px] text-slate-700 focus:border-indigo-400 focus:outline-none " +
            (status === "none" ? "cursor-not-allowed bg-slate-50 text-slate-300 placeholder:text-slate-300" : "")
          }
        />
      ) : (
        <div className="mt-1 h-4.5 text-[11px] leading-4.5 text-slate-500">{note || ""}</div>
      )}
    </div>
  )
}
